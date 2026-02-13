"""
Financial Agent Core — the main intelligence layer.

Accepts user query → detects intent → calls tools → injects structured data
into Gemini LLM → returns grounded, non-hallucinated response.
"""

import json
import re as _re
import time
import traceback

from app.agents.intent_classifier import Intent
from app.agents.llm_classifier import classify_query
from app.agents.safety import detect_risky_query, DISCLAIMER, check_rate_limit
from app.agents.memory import save_interaction, get_context_summary, get_last_tickers
from app.services.openai_llm import chat_completion
from app.services.yfinance.yf import (
    get_stock_quote,
    get_stock_history,
    get_company_info,
    search_ticker,
)
from app.services.yfinance.trend import analyze_trend
from app.services.yfinance.market import get_market_overview
from app.tools.db import search_scraped
from app.trading import service as trading_service


_TICKER_ALIASES = {
    "SENSEX": "^BSESN",
    "NIFTY": "^NSEI",
    "NIFTY50": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "DOWJONES": "^DJI",
    "DOW": "^DJI",
    "SP500": "^GSPC",
    "NASDAQ": "^IXIC",
}


def _normalize_tickers(tickers: list[str]) -> list[str]:
    """Normalize ticker symbols for yfinance compatibility."""
    normalized = []
    for ticker in tickers:
        upper = ticker.upper()
        if upper in _TICKER_ALIASES:
            normalized.append(_TICKER_ALIASES[upper])
            continue
        if any(c in upper for c in ['^', '.', '-', '=']):
            normalized.append(upper)
            continue
        try:
            results = search_ticker(upper)
            if results:
                nse_match = next(
                    (r["symbol"] for r in results
                     if r.get("symbol", "").endswith((".NS", ".BO"))),
                    None,
                )
                if nse_match:
                    normalized.append(nse_match)
                    continue
                top = results[0].get("symbol", "")
                if top.upper() == upper:
                    normalized.append(top)
                    continue
        except Exception:
            pass
        normalized.append(f"{upper}.NS")
    return normalized


def _fv(val, fmt=","):
    """Format a value safely, returning 'N/A' for None."""
    if val is None:
        return "N/A"
    try:
        return format(val, fmt)
    except (TypeError, ValueError):
        return str(val)


_SYSTEM_PROMPT = """You are a professional financial analysis AI assistant.

CRITICAL RULES:
1. For stock data and market analysis: Base your response ONLY on the structured data provided below. NEVER fabricate numbers, prices, or statistics.
2. For educational questions: You may use your training knowledge to explain financial concepts clearly. Use realistic examples.
3. If data is missing or unavailable, say so explicitly.
4. Always mention that this is not financial advice when discussing investments.
5. Be concise but thorough.
6. Always respond using well-formatted **Markdown**. Use headings (##, ###), bold (**text**), bullet points (- item), and tables where appropriate for readability.
7. When discussing stocks, always reference the actual data provided.
"""

_ADVISOR_SYSTEM_PROMPT = """You are a senior financial research analyst and investment advisor.

Your job is to give STRUCTURED, OPINIONATED investment analysis — not just raw data.
You MUST follow this exact response framework:

## 1. Key Metrics Table
Present a markdown table of the most important metrics for this asset/stock with columns:
| Metric | Current Value | Significance |

## 2. Decision Framework (3 Layers)

### Layer 1: Fundamental Health / Operational Efficiency
Analyze the company's financial strength or ETF's structure.
- For Stocks: PE ratio, market cap, debt, dividends, sector position.
- For ETFs: Tracking error, expense ratio, AUM.
Give a clear verdict.

### Layer 2: Technical Momentum
Analyze the current price action.
- Distance from 52W highs/lows.
- Moving Averages (200 SMA, 50 SMA).
- RSI and Trend direction.
Give a clear verdict.

### Layer 3: Macro Catalyst
What macro factors (industry trends, policy changes, global events) could drive the price up or down?

## 3. Summary: Should You Buy?

### The "Bull" Case (Buy)
Explain why someone would buy now. Be specific with price levels and catalysts.

### The "Bear" Case (Wait)
Explain risks and why someone might wait. Be specific with downside targets.

### My Analysis
Give your personal, OPINIONATED conclusion based on the data. Be decisive — say BUY, WAIT, or SELL with clear reasoning.
If you were to give a "Buy" signal, what specific conditions would you look for?

CRITICAL RULES:
1. Base ALL numbers on the structured data provided. NEVER fabricate prices or statistics.
2. Be OPINIONATED. The user wants advice, not a data dump.
3. Use well-formatted Markdown with tables, bold text, and clear section headers.
4. **MULTILINGUAL SUPPORT**: Detect the language of the user's query and respond in the SAME language. Do not translate standard financial terms (PE Ratio, RSI, MACD, ETF) but explain the analysis in the target language.
"""

_CONTEXT_TEMPLATE = """
=== USER CONTEXT (Previous Conversation) ===
{memory}

=== STRUCTURED DATA FROM TOOLS ===
{tool_data}

=== USER QUERY ===
{query}

Provide a grounded, data-driven response based ONLY on the above information.
"""


def _gather_stock_quote_data(tickers: list[str]) -> tuple[str, list[str]]:
    """Gather quote data for stock_quote intent."""
    tools_used = []
    sections = []

    for ticker in tickers[:3]:
        try:
            quote = get_stock_quote(ticker)
            tools_used.append("stock_quote")
            ccy = quote.get('currency', 'INR')
            sym = '₹' if ccy == 'INR' else '$'
            sections.append(
                f"--- {ticker} Quote ---\n"
                f"Name: {quote.get('name', 'N/A')}\n"
                f"Price: {sym}{_fv(quote.get('price'))}\n"
                f"Open: {sym}{_fv(quote.get('open'))}\n"
                f"Day High: {sym}{_fv(quote.get('day_high'))}\n"
                f"Day Low: {sym}{_fv(quote.get('day_low'))}\n"
                f"Previous Close: {sym}{_fv(quote.get('previous_close'))}\n"
                f"Volume: {_fv(quote.get('volume'))}\n"
                f"Market Cap: {sym}{_fv(quote.get('market_cap'))}\n"
                f"PE Ratio: {_fv(quote.get('pe_ratio'), '')}\n"
                f"52W High: {sym}{_fv(quote.get('52_week_high'))}\n"
                f"52W Low: {sym}{_fv(quote.get('52_week_low'))}\n"
            )
        except Exception as e:
            sections.append(f"--- {ticker} ---\nError fetching quote: {e}\n")

    return "\n".join(sections), tools_used


def _gather_stock_analysis_data(tickers: list[str]) -> tuple[str, list[str]]:
    """Gather comprehensive data for stock_analysis intent."""
    tools_used = []
    sections = []

    for ticker in tickers[:2]:
        try:
            quote = get_stock_quote(ticker)
            tools_used.append("stock_quote")
            ccy = quote.get('currency', 'INR')
            sym = '₹' if ccy == 'INR' else '$'
            sections.append(
                f"--- {ticker} Current Quote ---\n"
                f"Name: {quote.get('name', 'N/A')}\n"
                f"Price: {sym}{_fv(quote.get('price'))}\n"
                f"Previous Close: {sym}{_fv(quote.get('previous_close'))}\n"
                f"Market Cap: {sym}{_fv(quote.get('market_cap'))}\n"
                f"PE Ratio: {_fv(quote.get('pe_ratio'), '')}\n"
                f"Dividend Yield: {_fv(quote.get('dividend_yield'), '')}\n"
                f"52W High: {sym}{_fv(quote.get('52_week_high'))}\n"
                f"52W Low: {sym}{_fv(quote.get('52_week_low'))}\n"
            )
        except Exception as e:
            sections.append(f"--- {ticker} Quote Error: {e} ---\n")

        try:
            history = get_stock_history(ticker, period="1mo", interval="1d")
            tools_used.append("stock_history")
            trend = analyze_trend(history)
            tools_used.append("trend_analysis")
            sections.append(
                f"--- {ticker} 1-Month Trend Analysis ---\n"
                f"Direction: {trend['direction']}\n"
                f"Price Change: {trend['price_change_pct']:+.2f}%\n"
                f"Volatility: {trend['volatility_score']:.2f}/1.0\n"
                f"Support: ${trend['support']}\n"
                f"Resistance: ${trend['resistance']}\n"
                f"Avg Volume: {trend['avg_volume']:,}\n"
                f"Summary: {trend['summary']}\n"
            )
        except Exception as e:
            sections.append(f"--- {ticker} Trend Error: {e} ---\n")

        try:
            info = get_company_info(ticker)
            tools_used.append("company_info")
            sections.append(
                f"--- {ticker} Company Info ---\n"
                f"Sector: {info.get('sector')}\n"
                f"Industry: {info.get('industry')}\n"
                f"Employees: {info.get('employees')}\n"
                f"Description: {(info.get('description') or '')[:300]}...\n"
            )
        except Exception as e:
            sections.append(f"--- {ticker} Info Error: {e} ---\n")

        try:
            news = search_scraped(ticker, limit=3)
            if news:
                tools_used.append("news_scraper")
                news_text = "\n".join(
                    f"  - [{n.get('title', 'Untitled')}] {n.get('url', '')}"
                    for n in news
                )
                sections.append(f"--- {ticker} Related News ---\n{news_text}\n")
        except Exception:
            pass

    return "\n".join(sections), tools_used


def _gather_market_data() -> tuple[str, list[str]]:
    """Gather market overview data."""
    try:
        overview = get_market_overview()
        lines = ["--- Market Overview ---"]
        for item in overview:
            price_str = f"${item['price']:,.2f}" if item["price"] else "N/A"
            change_str = f"{item['change_pct']:+.2f}%" if item["change_pct"] is not None else ""
            lines.append(f"{item['name']} ({item['ticker']}): {price_str} {change_str}")
        return "\n".join(lines), ["market_overview"]
    except Exception as e:
        return f"Market overview error: {e}", []


def _gather_news_data(query: str) -> tuple[str, list[str]]:
    """Search scraped news relevant to the query."""
    try:
        search_terms = query.replace("news", "").replace("latest", "").strip()
        if not search_terms:
            search_terms = "finance"
        results = search_scraped(search_terms, limit=5)
        if results:
            lines = ["--- Relevant News Articles ---"]
            for r in results:
                text_preview = (r.get("text") or "")[:200]
                lines.append(f"Title: {r.get('title', 'Untitled')}")
                lines.append(f"URL: {r.get('url', '')}")
                lines.append(f"Preview: {text_preview}...")
                lines.append("")
            return "\n".join(lines), ["news_scraper"]
        return "No relevant news articles found in our database.", []
    except Exception as e:
        return f"News search error: {e}", []


def _gather_education_data(query: str) -> tuple[str, list[str]]:
    """For education queries, provide the query context to LLM."""
    return (
        f"The user wants to learn about a financial concept.\n"
        f"Query: {query}\n"
        f"Provide a clear, educational explanation suitable for a beginner.\n"
        f"Use examples with realistic numbers where appropriate."
    ), ["financial_education"]


def _gather_loan_data(query: str) -> tuple[str, list[str]]:
    """Context for loan queries."""
    return (
        f"The user has a loan-related question.\n"
        f"Query: {query}\n"
        f"Provide helpful information. If they need calculations, "
        f"suggest using our EMI calculator at /api/calc/emi."
    ), ["loan_advisor"]


def _gather_calculator_data(query: str) -> tuple[str, list[str]]:
    """Context for calculator queries."""
    return (
        f"The user wants to perform a financial calculation.\n"
        f"Query: {query}\n"
        f"Our available calculators:\n"
        f"  - SIP Calculator: POST /api/calc/sip (monthly_investment, annual_return_rate, years)\n"
        f"  - EMI Calculator: POST /api/calc/emi (principal, annual_interest_rate, tenure_months)\n"
        f"  - Compound Interest: POST /api/calc/compound (principal, annual_rate, years, compounding_frequency)\n"
        f"Guide the user on which calculator to use and what inputs to provide."
    ), ["calculator_guide"]


def _gather_trade_data(query: str, tickers: list[str]) -> tuple[str, list[str]]:
    """Context for trading commands — parsed by the agent for order preview."""
    return (
        f"The user wants to execute a paper trade.\n"
        f"Query: {query}\n"
        f"Detected tickers: {tickers or 'none'}\n"
        f"Available actions:\n"
        f"  - BUY shares: provide ticker, quantity, and current price\n"
        f"  - SELL shares: provide ticker, quantity, and current price\n"
        f"  - View portfolio: show holdings, balance, P&L\n"
        f"  - View trade history: past trades with timestamps\n"
        f"Parse the user's intent and respond with a clear summary.\n"
        f"If they want to buy or sell, mention the ticker, quantity, and that "
        f"they should confirm the order. The frontend will show a trade preview card."
    ), ["trading_engine"]


def _parse_chart_period(query: str) -> tuple[str, str]:
    """
    Extract yfinance period & interval from a natural-language query.

    Returns (period, interval).  Falls back to ("1mo", "1d").

    Supports patterns like:
      "7 days", "last 2 weeks", "1 month", "3 months", "6mo",
      "1 year", "today", "intraday", "weekly", "monthly", "yearly",
      "quarterly", "ytd", "all time", etc.
    """
    ql = query.lower()

    # ── exact yfinance tokens in the query ──────────────────────────
    for token in ("1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "ytd"):
        if token in ql:
            if token == "1d":
                return "1d", "5m"
            if token == "5d":
                return "5d", "15m"
            if token in ("1mo",):
                return "1mo", "1d"
            if token in ("3mo",):
                return "3mo", "1d"
            if token in ("6mo",):
                return "6mo", "1d"
            if token in ("1y",):
                return "1y", "1wk"
            if token in ("2y", "5y"):
                return token, "1wk"
            if token == "ytd":
                return "ytd", "1d"

    # ── "<N> day(s)" ────────────────────────────────────────────────
    m = _re.search(r'(\d+)\s*days?', ql)
    if m:
        days = int(m.group(1))
        if days <= 1:
            return "1d", "5m"
        if days <= 7:
            return "5d", "15m"
        if days <= 30:
            return "1mo", "1d"
        if days <= 90:
            return "3mo", "1d"
        if days <= 180:
            return "6mo", "1d"
        return "1y", "1d"

    # ── "<N> week(s)" ──────────────────────────────────────────────
    m = _re.search(r'(\d+)\s*weeks?', ql)
    if m:
        weeks = int(m.group(1))
        if weeks <= 1:
            return "5d", "15m"
        if weeks <= 4:
            return "1mo", "1d"
        if weeks <= 13:
            return "3mo", "1d"
        return "6mo", "1d"

    # ── "<N> month(s)" ─────────────────────────────────────────────
    m = _re.search(r'(\d+)\s*months?', ql)
    if m:
        months = int(m.group(1))
        if months <= 1:
            return "1mo", "1d"
        if months <= 3:
            return "3mo", "1d"
        if months <= 6:
            return "6mo", "1d"
        if months <= 12:
            return "1y", "1wk"
        return "2y", "1wk"

    # ── "<N> year(s)" ──────────────────────────────────────────────
    m = _re.search(r'(\d+)\s*years?', ql)
    if m:
        years = int(m.group(1))
        if years <= 1:
            return "1y", "1wk"
        if years <= 2:
            return "2y", "1wk"
        return "5y", "1mo"

    # ── keyword fallbacks ──────────────────────────────────────────
    if any(w in ql for w in ("today", "intraday", "intra-day")):
        return "1d", "5m"

    if any(w in ql for w in ("week", "weekly")):
        return "5d", "15m"

    if any(w in ql for w in ("month", "monthly", "one month", "last month")):
        return "1mo", "1d"

    if any(w in ql for w in ("quarter", "quarterly")):
        return "3mo", "1d"

    if any(w in ql for w in ("half year", "half-year", "six month")):
        return "6mo", "1d"

    if any(w in ql for w in ("year", "yearly", "annual", "annually", "one year", "last year")):
        return "1y", "1wk"

    if any(w in ql for w in ("all time", "all-time", "max", "maximum")):
        return "max", "1wk"

    # default: 1 month daily
    return "1mo", "1d"


def _gather_chart_context(query: str, tickers: list[str]) -> tuple[str, list[str]]:
    """Context for chart/graph requests — fetch data and provide analysis context."""
    if not tickers:
        return "No ticker identified for chart.", []

    ticker = tickers[0]
    period, interval = _parse_chart_period(query)
    
    try:
        history = get_stock_history(ticker, period=period, interval=interval)
        if not history:
             return f"No historical data found for {ticker}.", ["stock_history"]
        
        trend = analyze_trend(history)
        
        analysis = (
             f"--- {ticker} Chart Analysis ({period}) ---\n"
             f"Direction: {trend['direction']}\n"
             f"Price Change: {trend['price_change_pct']:+.2f}%\n"
             f"Volatility: {trend['volatility_score']:.2f}/1.0\n"
             f"Support: {trend['support']}\n"
             f"Resistance: {trend['resistance']}\n"
             f"Current Price: {history[-1]['close']}\n"
             f"Summary: {trend['summary']}\n\n"
             f"User Query: {query}\n"
             f"Provide a brief commentary on this trend. The visual chart will be rendered by the frontend."
        )
        return analysis, ["stock_history", "trend_analysis"]

    except Exception as e:
        return f"Error fetching chart data: {e}", []


def _gather_data_for_intent(
    intent: Intent, query: str, tickers: list[str]
) -> tuple[str, list[str]]:
    """Route to the correct data gatherer based on intent."""

    if intent == Intent.STOCK_QUOTE:
        if not tickers:
            tickers = _resolve_tickers_from_query(query)
        if tickers:
            tickers = _normalize_tickers(tickers)
            return _gather_stock_quote_data(tickers)
        return "No stock ticker could be identified from the query. Please specify a ticker symbol (e.g. TCS, RELIANCE, INFY).", []

    elif intent == Intent.STOCK_ANALYSIS:
        if not tickers:
            tickers = _resolve_tickers_from_query(query)
        if tickers:
            tickers = _normalize_tickers(tickers)
            return _gather_stock_analysis_data(tickers)
        return "No stock ticker could be identified. Please specify a stock (e.g. 'analyze TCS').", []

    elif intent == Intent.MARKET_STATUS:
        return _gather_market_data()

    elif intent == Intent.NEWS_QUERY:
        return _gather_news_data(query)

    elif intent == Intent.FINANCIAL_EDUCATION:
        return _gather_education_data(query)

    elif intent == Intent.LOAN_QUERY:
        return _gather_loan_data(query)

    elif intent == Intent.CALCULATOR:
        return _gather_calculator_data(query)

    elif intent == Intent.TRADE_ORDER:
        if not tickers:
            tickers = _resolve_tickers_from_query(query)
        if tickers:
            tickers = _normalize_tickers(tickers)
        return _gather_trade_data(query, tickers)

    elif intent == Intent.STOCK_CHART:
        if not tickers:
            tickers = _resolve_tickers_from_query(query)
        if tickers:
            tickers = _normalize_tickers(tickers)
        return _gather_chart_context(query, tickers)

    else:
        if tickers:
            tickers = _normalize_tickers(tickers)
            return _gather_stock_analysis_data(tickers)
        return (
            f"General finance query: {query}\n"
            f"Provide a helpful, accurate response."
        ), []


def _resolve_tickers_from_query(query: str) -> list[str]:
    """Try to resolve company names to tickers using yfinance search.
    Prefers NSE/BSE (.NS/.BO) matches over foreign exchange listings.
    """
    # Common words that start with uppercase (sentence-start) but aren't company names
    _SKIP_WORDS = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "need", "dare", "ought",
        "for", "and", "nor", "but", "or", "yet", "so", "in", "on", "at",
        "to", "of", "by", "from", "with", "about", "into", "through",
        "how", "what", "which", "who", "when", "where", "why",
        "show", "give", "get", "make", "create", "generate", "display",
        "chart", "graph", "plot", "analyze", "compare", "check", "find",
        "buy", "sell", "invest", "trade", "price", "stock", "share",
        "last", "next", "past", "recent", "today", "yesterday", "tomorrow",
        "ok", "okay", "yes", "no", "yeah", "nah", "sure", "fine", "right",
        "then", "also", "please", "thanks", "thank", "sorry", "hello", "hi",
        "hey", "well", "now", "just", "also", "too", "much", "many",
        "good", "bad", "best", "worst", "more", "less", "very", "really",
        "some", "any", "all", "each", "every", "other", "another",
        "short", "long", "term", "time", "day", "days", "week", "weeks",
        "month", "months", "year", "years", "ago", "since",
        "shares", "stocks", "market", "money", "profit", "loss",
    }

    words = query.split()
    search_terms = []
    for w in words:
        clean = w.strip("?.,!\"'")
        # Remove possessives: "Reliance's" → "Reliance"
        if clean.endswith("'s") or clean.endswith("\u2019s"):
            clean = clean[:-2]
        if clean and len(clean) > 1 and clean.lower() not in _SKIP_WORDS:
            # Only consider words that look like names (capitalized) or ALL-CAPS
            if clean[0].isupper():
                search_terms.append(clean)

    if not search_terms:
        return []

    for term in search_terms[:2]:
        try:
            results = search_ticker(term)
            if not results:
                continue
            # Prefer NSE/BSE matches
            nse_match = next(
                (r["symbol"] for r in results
                 if r.get("symbol", "").endswith((".NS", ".BO"))),
                None,
            )
            if nse_match:
                return [nse_match]
            # Fall back to top result only if symbol matches the search term
            top = results[0].get("symbol", "")
            if top and term.upper() in top.upper():
                return [top]
        except Exception:
            continue
    return []


def _format_fallback(intent: Intent, tool_data: str) -> str:
    """
    Convert raw tool data into user-friendly markdown when the LLM is unavailable.

    Instead of dumping internal prompt text, present the gathered data in a
    readable format — or show a friendly education response for concept queries
    where the tool_data is just an LLM prompt.
    """
    if intent in (Intent.FINANCIAL_EDUCATION, Intent.LOAN_QUERY, Intent.CALCULATOR):
        return (
            "I'm temporarily unable to generate a detailed response. "
            "Please try again in a moment — I'll be able to give you a thorough explanation shortly."
        )

    lines = tool_data.strip().splitlines()
    md_parts: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            md_parts.append("")
            continue
        heading = _re.match(r"^-{2,}\s*(.+?)\s*-{2,}$", stripped)
        if heading:
            md_parts.append(f"### {heading.group(1)}")
            continue
        kv = _re.match(r"^([A-Za-z0-9_ ]+?):\s*(.+)$", stripped)
        if kv:
            md_parts.append(f"- **{kv.group(1).strip()}:** {kv.group(2).strip()}")
            continue
        md_parts.append(stripped)

    return "\n".join(md_parts)


def _format_advisor_fallback(
    tickers: list[str],
    quote_data: dict,
    trend_data: dict,
    info_data: dict,
) -> str:
    """Generate a structured advisor response when the LLM is unavailable."""
    parts = []

    for ticker in tickers[:2]:
        q = quote_data.get(ticker, {})
        t = trend_data.get(ticker, {})
        inf = info_data.get(ticker, {})
        name = q.get('name', ticker)
        ccy = q.get('currency', 'INR')
        sym = '₹' if ccy == 'INR' else '$'
        price = q.get('price')
        pe = q.get('pe_ratio')
        mcap = q.get('market_cap')
        div_yield = q.get('dividend_yield')
        high52 = q.get('52_week_high')
        low52 = q.get('52_week_low')
        direction = t.get('direction', 'N/A')
        change_pct = t.get('price_change_pct', 0)
        volatility = t.get('volatility_score', 0)
        support = t.get('support', 'N/A')
        resistance = t.get('resistance', 'N/A')
        sector = inf.get('sector', 'N/A')
        industry = inf.get('industry', 'N/A')
        desc = (inf.get('description') or '')[:300]

        parts.append(f"## Investment Analysis: {name} ({ticker})\n")

        # Key Metrics Table
        parts.append("### Key Metrics\n")
        parts.append("| Metric | Value | Significance |")
        parts.append("|--------|-------|--------------|")
        parts.append(f"| **Current Price** | {sym}{_fv(price)} | {'Down' if change_pct < 0 else 'Up'} {abs(change_pct):.1f}% over 3 months |")
        parts.append(f"| **PE Ratio** | {_fv(pe, '')} | {'Fairly valued' if pe and 15 < pe < 25 else 'Premium valuation' if pe and pe > 25 else 'Value territory' if pe else 'N/A'} |")
        parts.append(f"| **Market Cap** | {sym}{_fv(mcap)} | {'Large-cap' if mcap and mcap > 500_000_000_000 else 'Mid-cap' if mcap and mcap > 50_000_000_000 else 'Small-cap' if mcap else 'N/A'} |")
        parts.append(f"| **Dividend Yield** | {_fv(div_yield, '')}% | {'Decent income' if div_yield and div_yield > 1 else 'Low income'} |")
        parts.append(f"| **52W Range** | {sym}{_fv(low52)} - {sym}{_fv(high52)} | {'Near highs' if price and high52 and price > high52 * 0.9 else 'Mid range' if price and high52 and price > high52 * 0.7 else 'Near lows'} |")
        parts.append(f"| **3M Trend** | {direction} | Volatility: {volatility:.2f}/1.0 |")
        parts.append("")

        # Layer 1: Fundamentals
        parts.append("### Layer 1: Fundamental Health / Operational Efficiency\n")
        if pe and pe < 20:
            parts.append(f"The stock trades at a **PE ratio of {_fv(pe, '')}**, which places it in reasonable valuation territory for the {sector or 'its'} sector. ")
        elif pe and pe > 30:
            parts.append(f"At a **PE ratio of {_fv(pe, '')}**, the stock is trading at a premium. This may be justified if growth prospects are strong, but it leaves less margin of safety. ")
        elif pe:
            parts.append(f"The **PE ratio of {_fv(pe, '')}** suggests a fairly valued stock for the {sector or 'its'} sector. ")
        if div_yield and div_yield > 0.5:
            parts.append(f"The **dividend yield of {_fv(div_yield, '')}%** provides some income cushion. ")
        parts.append(f"\n**Verdict:** {'Fundamentals look solid.' if pe and pe < 25 else 'Premium valuation — needs strong growth to justify.'}\n")

        # Layer 2: Technical Momentum
        parts.append("### Layer 2: Technical Momentum\n")
        dist_from_high = ((high52 - price) / high52 * 100) if price and high52 and high52 > 0 else 0
        parts.append(f"The stock is currently in a **{direction}** trend with a 3-month price change of **{change_pct:+.2f}%**. ")
        parts.append(f"It is trading **{dist_from_high:.1f}% below its 52-week high** of {sym}{_fv(high52)}. ")
        parts.append(f"Key levels: **Support at {sym}{support}**, **Resistance at {sym}{resistance}**. ")
        parts.append(f"\n**Verdict:** {'Momentum is positive — price is trending upward.' if direction == 'UPTREND' else 'Consolidation phase — wait for directional clarity.' if direction == 'SIDEWAYS' else 'Downtrend caution — wait for reversal signal.'}\n")

        # Layer 3: Macro
        parts.append("### Layer 3: Macro Catalyst\n")
        parts.append(f"**Sector:** {sector} | **Industry:** {industry}\n")
        if desc:
            parts.append(f"{desc}...\n")

        # Summary
        parts.append("### Should You Invest?\n")
        bull = direction == 'UPTREND' or (pe and pe < 20) or (dist_from_high > 15)
        parts.append(f"**Bull Case (Buy):** " + (
            f"The stock is in an uptrend with reasonable fundamentals. If it holds above {sym}{support}, accumulation makes sense."
            if bull else
            f"If the stock breaks above {sym}{resistance} with volume confirmation, it could signal a new leg up."
        ))
        parts.append("")
        parts.append(f"**Bear Case (Wait):** " + (
            f"After a {change_pct:+.1f}% move in 3 months, the easy gains may already be captured. A pullback to {sym}{support} would offer a better entry."
            if change_pct > 5 else
            f"The {direction.lower()} trend and recent weakness suggest patience. Wait for stabilization above {sym}{support}."
        ))
        parts.append("")
        if direction == 'UPTREND' and pe and pe < 30:
            parts.append(f"**My Analysis: ACCUMULATE** — The combination of {direction.lower()} momentum, reasonable valuation (PE {_fv(pe, '')}), and position relative to 52W range suggests a favorable risk-reward for gradual accumulation.")
        elif direction == 'SIDEWAYS':
            parts.append(f"**My Analysis: WAIT** — The stock is consolidating. Watch for a breakout above {sym}{resistance} or a bounce off {sym}{support} before initiating a position.")
        else:
            parts.append(f"**My Analysis: CAUTIOUS** — Given the current {direction.lower()} trend, it may be prudent to wait for clearer reversal signals before committing capital.")

    return "\n".join(parts)


def _translate_query(query: str, target_lang: str = "English") -> str:
    """Translate a non-English query to English for internal processing."""
    try:
        sys_prompt = "You are a helpful translator. Translate the following user query to English. Return ONLY the translation, no extra text."
        response = chat_completion(
            [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": f"Query ({target_lang}): {query}"},
            ],
            model="gemini-2.5-flash",
            temperature=0.0
        )
        return response.strip()
    except Exception:
        return query


def process_query(
    query: str,
    user_id: str = "anonymous",
    language: str = "en",
) -> dict:
    """
    Main agent entry point.

    1. Check safety guardrails
    2. Classify intent
    3. Gather structured data from tools
    4. Inject into LLM with grounding prompt
    5. Save to memory
    6. Return grounded response

    Returns:
        {
            "response": str,
            "intent": str,
            "tools_used": list[str],
            "tickers": list[str],
        }
    """
    if not check_rate_limit(user_id):
        return {
            "response": "You're sending too many requests. Please wait a moment and try again.",
            "intent": "rate_limited",
            "tools_used": [],
            "tickers": [],
        }

    risky_response = detect_risky_query(query)
    if risky_response:
        save_interaction(user_id, query, "risky_query", risky_response[:200])
        return {
            "response": risky_response + DISCLAIMER,
            "intent": "risky_query_blocked",
            "tools_used": ["safety_guardrail"],
            "tickers": [],
        }

    # Strip mode prefix (e.g. "[TRADE] ", "[CHART] ", "[ADVISOR] ") for clean LLM/tool input
    is_advisor_mode = query.upper().startswith("[ADVISOR]")
    
    # Multilingual Handling: Translate to English for internal logic (classification/tools)
    # but keep track of original language for the final response.
    english_query = query
    if language and language.lower() != "en":
        english_query = _translate_query(query, language)
        # Re-attach mode prefix if it was in the original query (though usually prefix is ASCII)
        if is_advisor_mode and not english_query.upper().startswith("[ADVISOR]"):
             english_query = "[ADVISOR] " + english_query

    clean_query = _re.sub(r'^\[(?:TRADE|CHART|ADVISOR)\]\s*', '', english_query, flags=_re.IGNORECASE)

    classification = classify_query(english_query)
    intent: Intent = classification["intent"]
    tickers: list[str] = classification["tickers"]
    reasoning = classification.get("reasoning", "")
    print(f"[Agent] Intent: {intent}, Tickers: {tickers}, Reasoning: {reasoning}")

    # Ticker resolution priority:
    # 1. Classifier already extracted tickers (above)
    # 2. Try resolving company names from the query text
    # 3. Only then fall back to conversation history
    if not tickers and intent in (
        Intent.STOCK_QUOTE, Intent.STOCK_ANALYSIS, Intent.STOCK_CHART,
        Intent.TRADE_ORDER,
    ):
        # Step 2: Try to find company names in the query
        query_tickers = _resolve_tickers_from_query(clean_query)
        if query_tickers:
            tickers = query_tickers
            print(f"[Agent] Resolved tickers from query text: {tickers}")
        else:
            # Step 3: Fall back to conversation history
            context_tickers = get_last_tickers(user_id)
            if context_tickers:
                tickers = context_tickers
                print(f"[Agent] Using context tickers from previous conversation: {tickers}")


    if language and language.lower() != "en" and intent == Intent.GENERAL_FINANCE and not tickers:
         # Fallback: if translation failed or was ambiguous, maybe try original query? 
         # But usually English is better for the classifier.
         pass

    try:
        tool_data, tools_used = _gather_data_for_intent(intent, clean_query, tickers)
    except Exception as e:
        tool_data = f"Error gathering data: {e}"
        tools_used = []

    try:
        memory = get_context_summary(user_id, last_n=3)
    except Exception:
        memory = None

    system_prompt = _SYSTEM_PROMPT
    advisor_steps = []
    if is_advisor_mode:
        system_prompt = _ADVISOR_SYSTEM_PROMPT
    
    
    _quote_data = {}
    _trend_data = {}
    _info_data = {}
    _resolved_tickers = []
    
    if language and language.lower() != "en":
        system_prompt += f"\n\nIMPORTANT: The user has selected the language: {language}. You MUST respond in {language}. If the user request involves actions (like 'buy', 'chart'), interpret them in {language} but use the English tool outputs."
    
    # Gather more comprehensive data for advisor mode
    if is_advisor_mode and tickers:
        resolved = _normalize_tickers(tickers)
        _resolved_tickers = resolved
        advisor_sections = []
        advisor_tools = list(tools_used or [])
        # _quote_data etc are already init above
        for ticker in resolved[:2]:
            advisor_steps.append({"step": len(advisor_steps) + 1, "title": "Loading Market Data", "detail": f"Fetching real-time quote for {ticker}", "status": "done"})
            try:
                quote = get_stock_quote(ticker)
                _quote_data[ticker] = quote
                ccy = quote.get('currency', 'INR')
                sym = '₹' if ccy == 'INR' else '$'
                advisor_sections.append(
                    f"--- {ticker} Detailed Quote ---\n"
                    f"Name: {quote.get('name', 'N/A')}\n"
                    f"Price: {sym}{_fv(quote.get('price'))}\n"
                    f"Open: {sym}{_fv(quote.get('open'))}\n"
                    f"Day High: {sym}{_fv(quote.get('day_high'))}\n"
                    f"Day Low: {sym}{_fv(quote.get('day_low'))}\n"
                    f"Previous Close: {sym}{_fv(quote.get('previous_close'))}\n"
                    f"Volume: {_fv(quote.get('volume'))}\n"
                    f"Market Cap: {sym}{_fv(quote.get('market_cap'))}\n"
                    f"PE Ratio: {_fv(quote.get('pe_ratio'), '')}\n"
                    f"Dividend Yield: {_fv(quote.get('dividend_yield'), '')}\n"
                    f"52W High: {sym}{_fv(quote.get('52_week_high'))}\n"
                    f"52W Low: {sym}{_fv(quote.get('52_week_low'))}\n"
                )
                if "stock_quote" not in advisor_tools:
                    advisor_tools.append("stock_quote")
            except Exception as eq:
                print(f"[Advisor] Quote error for {ticker}: {eq}")

            advisor_steps.append({"step": len(advisor_steps) + 1, "title": "Analyzing Fundamentals", "detail": f"PE ratio, market cap, dividends for {ticker}", "status": "done"})

            advisor_steps.append({"step": len(advisor_steps) + 1, "title": "Running Technical Analysis", "detail": f"3-month trend, support/resistance, momentum for {ticker}", "status": "done"})
            try:
                history = get_stock_history(ticker, period="3mo", interval="1d")
                trend = analyze_trend(history)
                _trend_data[ticker] = trend
                advisor_sections.append(
                    f"--- {ticker} 3-Month Trend Analysis ---\n"
                    f"Direction: {trend['direction']}\n"
                    f"Price Change: {trend['price_change_pct']:+.2f}%\n"
                    f"Volatility: {trend['volatility_score']:.2f}/1.0\n"
                    f"Support: {trend['support']}\n"
                    f"Resistance: {trend['resistance']}\n"
                    f"Avg Volume: {trend['avg_volume']:,}\n"
                    f"Summary: {trend['summary']}\n"
                )
                for t in ["stock_history", "trend_analysis"]:
                    if t not in advisor_tools:
                        advisor_tools.append(t)
            except Exception as et:
                print(f"[Advisor] Trend error for {ticker}: {et}")

            advisor_steps.append({"step": len(advisor_steps) + 1, "title": "Evaluating Company Profile", "detail": f"Sector, business model, competitive position for {ticker}", "status": "done"})
            try:
                info = get_company_info(ticker)
                _info_data[ticker] = info
                advisor_sections.append(
                    f"--- {ticker} Company Profile ---\n"
                    f"Sector: {info.get('sector')}\n"
                    f"Industry: {info.get('industry')}\n"
                    f"Employees: {info.get('employees')}\n"
                    f"Description: {(info.get('description') or '')[:400]}\n"
                )
                if "company_info" not in advisor_tools:
                    advisor_tools.append("company_info")
            except Exception as ei:
                print(f"[Advisor] Info error for {ticker}: {ei}")

        advisor_steps.append({"step": len(advisor_steps) + 1, "title": "Generating Investment Thesis", "detail": "Building bull/bear cases and investment recommendation", "status": "done"})

        if advisor_sections:
            tool_data = "\n".join(advisor_sections)
            tools_used = advisor_tools

    prompt = _CONTEXT_TEMPLATE.format(
        memory=memory or "(No previous conversation)",
        tool_data=tool_data,
        query=clean_query,
    )

    answer = None
    for attempt in range(3):
        try:
            answer = chat_completion(system_prompt, prompt)
            break
        except Exception as e:
            error_str = str(e)
            is_rate_limit = "429" in error_str or "rate" in error_str.lower()
            if is_rate_limit and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            break

    if answer is None:
        if is_advisor_mode and tickers:
            # Generate structured advisor fallback from collected data
            answer = _format_advisor_fallback(_resolved_tickers or tickers, _quote_data, _trend_data, _info_data)
        else:
            answer = _format_fallback(intent, tool_data)

    if intent in (Intent.STOCK_ANALYSIS, Intent.STOCK_QUOTE, Intent.MARKET_STATUS, Intent.LOAN_QUERY):
        answer += DISCLAIMER

    chart_data = None
    trade_preview = None

    if intent == Intent.STOCK_CHART:
        chart_tickers = tickers
        if not chart_tickers:
            chart_tickers = _resolve_tickers_from_query(clean_query)
        if chart_tickers:
            resolved = _normalize_tickers(chart_tickers)
            period, interval = _parse_chart_period(clean_query)
            try:
                ticker = resolved[0]
                history = get_stock_history(ticker, period=period, interval=interval)
                if history and isinstance(history, list) and len(history) > 0:
                    chart_data = {
                        "ticker": ticker,
                        "period": period,
                        "interval": interval,
                        "data": history[:500],
                    }
                    # Update tickers for response metadata
                    if not tickers:
                        tickers = chart_tickers
            except Exception:
                pass

    if intent == Intent.TRADE_ORDER:
        trade_tickers = tickers
        if not trade_tickers:
            trade_tickers = _resolve_tickers_from_query(clean_query)
        if trade_tickers:
            resolved = _normalize_tickers(trade_tickers)
            ql = clean_query.lower()
            side = "BUY"
            if any(w in ql for w in ["sell", "exit", "liquidate", "offload"]):
                side = "SELL"
            qty = 1
            for word in clean_query.split():
                try:
                    num = int(word)
                    if 1 <= num <= 100000:
                        qty = num
                        break
                except ValueError:
                    continue
            try:
                preview = trading_service.preview_order(
                    user_id=user_id,
                    ticker=resolved[0],
                    side=side,
                    quantity=qty,
                )
                trade_preview = preview
                if not tickers:
                    tickers = trade_tickers
            except Exception:
                pass

    try:
        save_interaction(user_id, clean_query, intent.value, answer[:300], tickers=tickers)
    except Exception:
        pass

    seen = set()
    unique_tools = []
    for t in tools_used:
        if t not in seen:
            seen.add(t)
            unique_tools.append(t)

    result = {
        "response": answer,
        "intent": intent.value,
        "tools_used": unique_tools,
        "tickers": tickers,
    }
    if chart_data:
        result["chart_data"] = chart_data
    if trade_preview:
        result["trade_preview"] = trade_preview
    if advisor_steps:
        result["advisor_thinking"] = advisor_steps
    return result
