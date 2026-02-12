"""
Financial Agent Core — the main intelligence layer.

Accepts user query → detects intent → calls tools → injects structured data
into Gemini LLM → returns grounded, non-hallucinated response.
"""

import json
import traceback

from app.agents.intent_classifier import Intent, classify, extract_tickers
from app.agents.safety import detect_risky_query, DISCLAIMER, check_rate_limit
from app.agents.memory import save_interaction, get_context_summary
from app.services.gemini import client as gemini_client
from app.services.yfinance.yf import (
    get_stock_quote,
    get_stock_history,
    get_company_info,
    search_ticker,
)
from app.services.yfinance.trend import analyze_trend
from app.services.yfinance.market import get_market_overview
from app.tools.db import search_scraped


# ── Prompt Templates ─────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are a professional financial analysis AI assistant.

CRITICAL RULES:
1. For stock data and market analysis: Base your response ONLY on the structured data provided below. NEVER fabricate numbers, prices, or statistics.
2. For educational questions: You may use your training knowledge to explain financial concepts clearly. Use realistic examples.
3. If data is missing or unavailable, say so explicitly.
4. Always mention that this is not financial advice when discussing investments.
5. Be concise but thorough.
6. Use bullet points and clear formatting.
7. When discussing stocks, always reference the actual data provided.
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


# ── Tool Execution per Intent ────────────────────────────────────────────────

def _gather_stock_quote_data(tickers: list[str]) -> tuple[str, list[str]]:
    """Gather quote data for stock_quote intent."""
    tools_used = []
    sections = []

    for ticker in tickers[:3]:  # cap at 3 tickers per request
        try:
            quote = get_stock_quote(ticker)
            tools_used.append("stock_quote")
            sections.append(
                f"--- {ticker} Quote ---\n"
                f"Name: {quote.get('name')}\n"
                f"Price: ${quote.get('price')}\n"
                f"Open: ${quote.get('open')}\n"
                f"Day High: ${quote.get('day_high')}\n"
                f"Day Low: ${quote.get('day_low')}\n"
                f"Previous Close: ${quote.get('previous_close')}\n"
                f"Volume: {quote.get('volume'):,}\n"
                f"Market Cap: ${quote.get('market_cap'):,}\n"
                f"PE Ratio: {quote.get('pe_ratio')}\n"
                f"52W High: ${quote.get('52_week_high')}\n"
                f"52W Low: ${quote.get('52_week_low')}\n"
            )
        except Exception as e:
            sections.append(f"--- {ticker} ---\nError fetching quote: {e}\n")

    return "\n".join(sections), tools_used


def _gather_stock_analysis_data(tickers: list[str]) -> tuple[str, list[str]]:
    """Gather comprehensive data for stock_analysis intent."""
    tools_used = []
    sections = []

    for ticker in tickers[:2]:  # cap at 2 for analysis (heavier)
        # Quote
        try:
            quote = get_stock_quote(ticker)
            tools_used.append("stock_quote")
            sections.append(
                f"--- {ticker} Current Quote ---\n"
                f"Name: {quote.get('name')}\n"
                f"Price: ${quote.get('price')}\n"
                f"Previous Close: ${quote.get('previous_close')}\n"
                f"Market Cap: ${quote.get('market_cap'):,}\n"
                f"PE Ratio: {quote.get('pe_ratio')}\n"
                f"Dividend Yield: {quote.get('dividend_yield')}\n"
                f"52W High: ${quote.get('52_week_high')}\n"
                f"52W Low: ${quote.get('52_week_low')}\n"
            )
        except Exception as e:
            sections.append(f"--- {ticker} Quote Error: {e} ---\n")

        # History + Trend
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

        # Company Info
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

        # News from scraped data
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
        # Extract meaningful search terms
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


# ── Intent → Data Gatherer Map ───────────────────────────────────────────────

def _gather_data_for_intent(
    intent: Intent, query: str, tickers: list[str]
) -> tuple[str, list[str]]:
    """Route to the correct data gatherer based on intent."""

    if intent == Intent.STOCK_QUOTE:
        if not tickers:
            tickers = _resolve_tickers_from_query(query)
        if tickers:
            return _gather_stock_quote_data(tickers)
        return "No stock ticker could be identified from the query. Please specify a ticker symbol (e.g. AAPL, TSLA).", []

    elif intent == Intent.STOCK_ANALYSIS:
        if not tickers:
            tickers = _resolve_tickers_from_query(query)
        if tickers:
            return _gather_stock_analysis_data(tickers)
        return "No stock ticker could be identified. Please specify a stock (e.g. 'analyze AAPL').", []

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

    else:  # GENERAL_FINANCE
        if tickers:
            return _gather_stock_analysis_data(tickers)
        return (
            f"General finance query: {query}\n"
            f"Provide a helpful, accurate response."
        ), []


def _resolve_tickers_from_query(query: str) -> list[str]:
    """Try to resolve company names to tickers using yfinance search."""
    words = query.split()
    search_terms = []
    for w in words:
        clean = w.strip("?.,!\"'")
        if clean and clean[0].isupper() and len(clean) > 1:
            search_terms.append(clean)

    if not search_terms:
        search_terms = [query]

    for term in search_terms[:2]:
        try:
            results = search_ticker(term)
            if results and results[0].get("symbol"):
                return [results[0]["symbol"]]
        except Exception:
            continue
    return []


# ── Main Agent Entry Point ───────────────────────────────────────────────────

def process_query(
    query: str,
    user_id: str = "anonymous",
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
    # ── Rate limiting ────────────────────────────────────────────────────
    if not check_rate_limit(user_id):
        return {
            "response": "You're sending too many requests. Please wait a moment and try again.",
            "intent": "rate_limited",
            "tools_used": [],
            "tickers": [],
        }

    # ── Safety check ─────────────────────────────────────────────────────
    risky_response = detect_risky_query(query)
    if risky_response:
        save_interaction(user_id, query, "risky_query", risky_response[:200])
        return {
            "response": risky_response + DISCLAIMER,
            "intent": "risky_query_blocked",
            "tools_used": ["safety_guardrail"],
            "tickers": [],
        }

    # ── Intent classification ────────────────────────────────────────────
    classification = classify(query)
    intent: Intent = classification["intent"]
    tickers: list[str] = classification["tickers"]

    # ── Gather data from tools ───────────────────────────────────────────
    try:
        tool_data, tools_used = _gather_data_for_intent(intent, query, tickers)
    except Exception as e:
        tool_data = f"Error gathering data: {e}"
        tools_used = []

    # ── Build memory context ─────────────────────────────────────────────
    memory = get_context_summary(user_id, last_n=3)

    # ── Call Gemini with grounded prompt ──────────────────────────────────
    prompt = _CONTEXT_TEMPLATE.format(
        memory=memory or "(No previous conversation)",
        tool_data=tool_data,
        query=query,
    )

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {"role": "user", "parts": [{"text": _SYSTEM_PROMPT + "\n\n" + prompt}]}
            ],
        )
        answer = response.text.strip()
    except Exception as e:
        answer = f"I encountered an error generating a response: {e}. However, here's what I found:\n\n{tool_data}"

    # Append disclaimer for stock/financial analysis
    if intent in (Intent.STOCK_ANALYSIS, Intent.STOCK_QUOTE, Intent.MARKET_STATUS, Intent.LOAN_QUERY):
        answer += DISCLAIMER

    # ── Save to memory ───────────────────────────────────────────────────
    try:
        save_interaction(user_id, query, intent.value, answer[:300])
    except Exception:
        pass  # memory save failure shouldn't break the response

    # Deduplicate tools_used
    seen = set()
    unique_tools = []
    for t in tools_used:
        if t not in seen:
            seen.add(t)
            unique_tools.append(t)

    return {
        "response": answer,
        "intent": intent.value,
        "tools_used": unique_tools,
        "tickers": tickers,
    }
