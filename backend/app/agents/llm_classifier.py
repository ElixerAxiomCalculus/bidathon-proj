
"""
LLM-Based Intent Classification — v2.1.0

A highly sophisticated, multi-stage prompt understanding engine that handles:
- Casual and conversational language ("wanna see how tcs is doing", "lemme check reliance")
- Typos and misspellings ("rleiance chart", "infosys stok price")
- Mixed-language queries (Hinglish, Hindi, regional expressions)
- Implicit intents (no explicit buy/sell keyword but context implies it)
- Ambiguous queries resolved via context signals
- Multi-entity extraction (tickers, time ranges, quantities, currencies)
"""

import json
import re
import unicodedata
from typing import TypedDict, List, Optional

from app.services.openai_llm import chat_completion
from app.agents.intent_classifier import Intent, classify as keyword_classify


class ClassificationResult(TypedDict):
    intent: Intent
    tickers: List[str]
    reasoning: str
    confidence: float
    quantity: Optional[int]
    side: Optional[str]           # BUY | SELL | None
    time_period: Optional[str]    # e.g. "1mo", "3mo", "1y"
    normalized_query: Optional[str]


# ── Comprehensive system prompt for deep prompt understanding ──────────────
_SYSTEM_PROMPT = """You are FinAlly's ultra-sophisticated Financial Natural Language Understanding (NLU) engine.

Your job is to deeply understand what a user wants — even from casual, typo-laden, Hinglish, or ambiguous messages — and extract structured intent.

═══════════════════════════════════════════════════════════════════
SUPPORTED INTENTS (pick exactly one):
═══════════════════════════════════════════════════════════════════
- `stock_quote`        → User wants the current price of a specific stock/ETF/index.
- `stock_analysis`     → User wants investment analysis, advice, outlook, prediction, or a recommendation.
- `stock_chart`        → User wants a chart, graph, price history, or visual trend.
- `trade_order`        → User wants to BUY or SELL shares, OR view portfolio/holdings/balance.
- `market_status`      → User asks about the overall market, indices (Nifty/Sensex), or market conditions.
- `news_query`         → User wants news, headlines, or recent events about a stock/market.
- `calculator`         → User wants to calculate SIP returns, EMI, compound interest, or financial math.
- `loan_query`         → User asks about loans, mortgages, EMI, interest rates, repayment.
- `financial_education`→ User wants to understand a concept ("what is", "explain", "how does X work").
- `general_finance`    → Anything that doesn't fit the above (greetings, general chat, misc).

═══════════════════════════════════════════════════════════════════
CASUAL LANGUAGE PATTERNS (these are real user messages — understand them):
═══════════════════════════════════════════════════════════════════
- "wanna see reliance chart" → stock_chart (want to = want to see)
- "how's tcs doing today" → stock_quote (how is = current price query)
- "lemme buy 5 infy" → trade_order, BUY, qty=5, ticker=INFY
- "rleiance ki price kya hai" → stock_quote, ticker=RELIANCE (typo + Hindi)
- "kal market kaisa tha" → market_status (Hindi: what was market like yesterday)
- "sensex upar hai ya neeche" → market_status (Hindi: is sensex up or down)
- "TCS mein paisa lagaun kya" → stock_analysis (Hindi: should I invest in TCS)
- "dho share bech do hdfc ke" → trade_order, SELL, ticker=HDFC (Hindi: sell 2 shares of hdfc)
- "itna invest karna chahiye SIP mein" → calculator
- "yaar reliance kitne ka hai" → stock_quote (informal: hey what's reliance's price)
- "show me the last 3 month performance of infy" → stock_chart, period=3mo
- "is it a good time to enter tata motors" → stock_analysis
- "can u analyze hdfc for me" → stock_analysis
- "plot tcs weekly" → stock_chart, period=5d (weekly = 5d)
- "mkt update" → market_status (abbreviated: market update)
- "my holdings dikh" → trade_order (Hinglish: show my holdings)
- "kitna bacha hai wallet mein" → trade_order (Hindi: how much is left in wallet)
- "compare reliance vs tata" → stock_analysis (comparative analysis intent)
- "5 saal mein 10 lakh ka kya hoga SIP mein" → calculator

═══════════════════════════════════════════════════════════════════
ENTITY EXTRACTION RULES:
═══════════════════════════════════════════════════════════════════

**Tickers** — extract from:
- Explicit symbols: TCS, INFY, RELIANCE, HDFC, WIPRO, BAJFINANCE, HDFCBANK, ICICIBANK, KOTAKBANK, SBIN, ITC, AXISBANK, MARUTI, TATASTEEL, TATAMOTORS, SUNPHARMA, DRREDDY, BPCL, ONGC, POWERGRID, NESTLEIND, BRITANNIA, ASIANPAINT, TITAN, CIPLA, ADANIPORTS, HINDALCO, JSWSTEEL, HCLTECH, LT, ULTRACEMCO, COALINDIA, INDUSINDBK, GRASIM, DIVISLAB, TECHM, APOLLOHOSP, BAJAJFINSV, EICHERMOT, HEROMOTOCO, BAJAJ-AUTO, NTPC, RITES, IRFC, IRCTC, ZOMATO, NYKAA, PAYTM, DELHIVERY
- Common name variants: "Reliance" → RELIANCE, "infosys" → INFY, "tata motors" → TATAMOTORS, "hdfc bank" → HDFCBANK, "sbi" → SBIN, "icici" → ICICIBANK, "kotak" → KOTAKBANK, "tcs" → TCS, "wipro" → WIPRO, "axis bank" → AXISBANK, "bajaj finance" → BAJFINANCE
- Index aliases: "sensex" → ^BSESN, "nifty" → ^NSEI, "bank nifty" → ^NSEBANK, "nasdaq" → ^IXIC, "s&p" → ^GSPC
- US stocks: "apple" → AAPL, "tesla" → TSLA, "google" / "alphabet" → GOOGL, "microsoft" → MSFT, "amazon" → AMZN, "meta" → META, "nvidia" → NVDA
- ETFs/MFs: "goldbees" → GOLDBEES.NS, "niftybees" → NIFTYBEES.NS, "silverbees" → SILVERBEES.NS
- Typos: "rleiance" → RELIANCE, "infossys" → INFY, "wiipro" → WIPRO
- Hinglish: "reliance wala" → RELIANCE, "TCS ka share" → TCS

**Quantity** — extract numeric quantities:
- "buy 10 tcs" → quantity=10
- "5 shares of reliance" → quantity=5
- "ek sau" (Hindi: 100) → quantity=100
- "do share" (Hindi: 2 shares) → quantity=2
- "ek" (Hindi: 1) → quantity=1
- "paanch" (Hindi: 5) → quantity=5
- "das" (Hindi: 10) → quantity=10

**Side** — detect buy/sell:
- BUY keywords: buy, purchase, acquire, kharido, le lo, lena, invest in, add
- SELL keywords: sell, exit, offload, becho, nikaalo, bechna, liquidate, dispose

**Time period** — map to yfinance format:
- "today" / "intraday" → "1d"
- "this week" / "weekly" / "past week" / "5 days" / "5d" → "5d"
- "1 month" / "past month" / "mahina" → "1mo"
- "3 months" / "quarter" / "teen mahine" → "3mo"
- "6 months" → "6mo"
- "1 year" / "annual" / "ek saal" → "1y"
- "2 years" / "do saal" → "2y"
- "5 years" / "paanch saal" → "5y"
- "all time" / "max" → "max"
- default (unspecified) → null

═══════════════════════════════════════════════════════════════════
TYPO CORRECTION HEURISTICS:
═══════════════════════════════════════════════════════════════════
When the query has a clear typo or misspelling of a known company/ticker, correct it silently:
- "rleiance" → RELIANCE
- "infossys" / "infosys" → INFY
- "relaince" → RELIANCE
- "wip ro" → WIPRO
- "tatamtor" → TATAMOTORS
- "hdfcbnk" → HDFCBANK

═══════════════════════════════════════════════════════════════════
AMBIGUITY RESOLUTION:
═══════════════════════════════════════════════════════════════════
When the query is ambiguous between intents, use these priority rules:
1. If [TRADE], [CHART], [ADVISOR] prefix present → always force that intent
2. If user mentions buying/selling quantity → trade_order
3. If user asks "should I" / "good time" / "invest" → stock_analysis
4. If user says "chart" / "graph" / "plot" / "show" + ticker → stock_chart
5. If user just names a stock with no action → stock_quote (default lookup)
6. Vague "how is X doing" → stock_quote

═══════════════════════════════════════════════════════════════════
CONFIDENCE SCORING:
═══════════════════════════════════════════════════════════════════
Score your confidence 0.0–1.0:
- 0.9–1.0: Very clear intent with explicit keywords
- 0.7–0.8: Clear intent inferred from context
- 0.5–0.6: Ambiguous but best guess
- 0.3–0.4: Uncertain, mostly fallback

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT — respond ONLY with valid JSON:
═══════════════════════════════════════════════════════════════════
{
  "intent": "<one_of_the_intents>",
  "tickers": ["<TICKER_1>", "<TICKER_2>"],
  "quantity": <null_or_integer>,
  "side": <null_or_"BUY"_or_"SELL">,
  "time_period": <null_or_yfinance_period_string>,
  "normalized_query": "<cleaned English version of the query, correcting typos and translating non-English parts>",
  "confidence": <0.0_to_1.0>,
  "reasoning": "<2-3 sentence explanation of your classification>"
}
"""

# ── Common company name to ticker lookup (for extra robustness) ────────────
_COMPANY_NAME_MAP = {
    "reliance": "RELIANCE", "reliances": "RELIANCE", "rleiance": "RELIANCE", "relaince": "RELIANCE",
    "tcs": "TCS", "tata consultancy": "TCS", "tata consultancy services": "TCS",
    "infosys": "INFY", "infy": "INFY", "infossys": "INFY", "infosys ltd": "INFY",
    "wipro": "WIPRO", "wiipro": "WIPRO",
    "hdfc bank": "HDFCBANK", "hdfcbank": "HDFCBANK", "hdfc": "HDFCBANK",
    "icici bank": "ICICIBANK", "icici": "ICICIBANK",
    "kotak bank": "KOTAKBANK", "kotak": "KOTAKBANK", "kotak mahindra": "KOTAKBANK",
    "sbi": "SBIN", "state bank": "SBIN", "state bank of india": "SBIN",
    "axis bank": "AXISBANK", "axis": "AXISBANK",
    "bajaj finance": "BAJFINANCE", "bajfinance": "BAJFINANCE",
    "tata motors": "TATAMOTORS", "tatamotors": "TATAMOTORS", "tata motor": "TATAMOTORS",
    "tata steel": "TATASTEEL", "tatasteel": "TATASTEEL",
    "maruti": "MARUTI", "maruti suzuki": "MARUTI",
    "itc": "ITC", "itc ltd": "ITC",
    "lt": "LT", "l&t": "LT", "larsen": "LT", "larsen and toubro": "LT",
    "sun pharma": "SUNPHARMA", "sunpharma": "SUNPHARMA",
    "dr reddy": "DRREDDY", "drreddy": "DRREDDY", "dr reddys": "DRREDDY",
    "hcl": "HCLTECH", "hcl tech": "HCLTECH", "hcltech": "HCLTECH",
    "tech mahindra": "TECHM", "techm": "TECHM",
    "adani ports": "ADANIPORTS", "adaniports": "ADANIPORTS",
    "asian paint": "ASIANPAINT", "asian paints": "ASIANPAINT",
    "titan": "TITAN",
    "cipla": "CIPLA",
    "bajaj auto": "BAJAJ-AUTO",
    "hero motocorp": "HEROMOTOCO", "hero moto": "HEROMOTOCO",
    "eicher": "EICHERMOT", "royal enfield": "EICHERMOT",
    "britannia": "BRITANNIA",
    "nestle": "NESTLEIND",
    "irctc": "IRCTC",
    "zomato": "ZOMATO",
    "nykaa": "NYKAA",
    "paytm": "PAYTM",
    "apple": "AAPL", "aapl": "AAPL",
    "tesla": "TSLA", "tsla": "TSLA",
    "google": "GOOGL", "alphabet": "GOOGL", "googl": "GOOGL",
    "microsoft": "MSFT", "msft": "MSFT",
    "amazon": "AMZN", "amzn": "AMZN",
    "meta": "META", "facebook": "META",
    "nvidia": "NVDA", "nvda": "NVDA",
    "sensex": "^BSESN", "bsesn": "^BSESN",
    "nifty": "^NSEI", "nifty50": "^NSEI", "nifty 50": "^NSEI",
    "bank nifty": "^NSEBANK", "banknifty": "^NSEBANK",
    "nasdaq": "^IXIC",
    "s&p": "^GSPC", "sp500": "^GSPC", "s&p 500": "^GSPC",
    "dow jones": "^DJI", "dow": "^DJI",
    "goldbees": "GOLDBEES.NS", "gold bee": "GOLDBEES.NS",
    "niftybees": "NIFTYBEES.NS",
    "silverbees": "SILVERBEES.NS",
}

# ── Hindi/Hinglish number words ────────────────────────────────────────────
_HINDI_NUMBERS = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5,
    "chhe": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
    "bees": 20, "tees": 30, "pachaas": 50, "ek sau": 100,
    "sau": 100, "hazaar": 1000,
}


def _normalize_text(text: str) -> str:
    """Normalize unicode characters and common substitutions."""
    text = unicodedata.normalize("NFKC", text)
    return text


def _extract_quantity_from_hindi(text: str) -> Optional[int]:
    """Extract quantity from Hindi number words."""
    lower = text.lower()
    for word, val in sorted(_HINDI_NUMBERS.items(), key=lambda x: -len(x[0])):
        if re.search(rf'\b{re.escape(word)}\b', lower):
            return val
    return None


def _pre_classify_from_name_map(query: str) -> List[str]:
    """
    Quick local pass: extract tickers using the known company name map.
    This catches company names that the LLM might miss due to language variance.
    """
    lower = query.lower()
    found = []
    seen = set()
    # Sort by length descending so "hdfc bank" matches before "hdfc"
    for name, ticker in sorted(_COMPANY_NAME_MAP.items(), key=lambda x: -len(x[0])):
        if name in lower and ticker not in seen:
            found.append(ticker)
            seen.add(ticker)
            if len(found) >= 3:
                break
    return found


def _clean_json_response(text: str) -> dict:
    """Extract JSON from potential markdown fences or preamble text."""
    text = text.strip()
    # Strip markdown fences
    if "```" in text:
        # Find JSON between fences
        m = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', text)
        if m:
            text = m.group(1)
    # Find the first { ... } block
    m = re.search(r'\{[\s\S]+\}', text)
    if m:
        text = m.group(0)
    return json.loads(text.strip())


def _merge_tickers(llm_tickers: List[str], name_map_tickers: List[str]) -> List[str]:
    """
    Merge tickers from LLM output and local name map, deduplicating.
    LLM tickers take precedence; name map fills gaps.
    """
    seen = set()
    result = []
    for t in llm_tickers + name_map_tickers:
        clean = t.strip().upper().lstrip("$")
        if clean and clean not in seen:
            seen.add(clean)
            result.append(t.strip())  # preserve original casing from LLM
    return result[:3]


def classify_query(query: str) -> ClassificationResult:
    """
    Classify a user query using a sophisticated LLM-powered NLU engine.

    Pipeline:
    1. Pre-process: normalize Unicode, detect obvious company name mentions
    2. LLM classification with rich prompt engineering (handles casual, Hinglish, typos)
    3. Post-process: merge local name map tickers with LLM tickers
    4. Graceful fallback to keyword matching if LLM fails

    Returns:
        ClassificationResult with intent, tickers, quantity, side, time_period,
        normalized_query, confidence, and reasoning.
    """
    query = _normalize_text(query)

    # Step 1: Local pre-pass to catch known company names
    local_tickers = _pre_classify_from_name_map(query)

    try:
        response_text = chat_completion(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=f"User Query: {query}"
        )
        data = _clean_json_response(response_text)

        # ── Validate and map intent ────────────────────────────────────────
        intent_val = (data.get("intent") or "").lower().strip()
        classification = Intent.GENERAL_FINANCE

        if intent_val in [i.value for i in Intent]:
            classification = Intent(intent_val)
        else:
            # Soft fuzzy match (e.g. "trade" → trade_order)
            _fuzzy_map = {
                "trade": Intent.TRADE_ORDER, "buy": Intent.TRADE_ORDER,
                "sell": Intent.TRADE_ORDER, "order": Intent.TRADE_ORDER,
                "chart": Intent.STOCK_CHART, "graph": Intent.STOCK_CHART,
                "analysis": Intent.STOCK_ANALYSIS, "analyze": Intent.STOCK_ANALYSIS,
                "advice": Intent.STOCK_ANALYSIS,
                "quote": Intent.STOCK_QUOTE, "price": Intent.STOCK_QUOTE,
                "market": Intent.MARKET_STATUS,
                "news": Intent.NEWS_QUERY,
                "calc": Intent.CALCULATOR, "calculate": Intent.CALCULATOR,
                "loan": Intent.LOAN_QUERY, "emi": Intent.LOAN_QUERY,
                "education": Intent.FINANCIAL_EDUCATION, "learn": Intent.FINANCIAL_EDUCATION,
            }
            for key, mapped_intent in _fuzzy_map.items():
                if key in intent_val:
                    classification = mapped_intent
                    break

        # ── Merge tickers ──────────────────────────────────────────────────
        llm_tickers = data.get("tickers") or []
        merged_tickers = _merge_tickers(llm_tickers, local_tickers)

        # ── Extract optional fields ────────────────────────────────────────
        quantity = data.get("quantity")
        if quantity is None:
            quantity = _extract_quantity_from_hindi(query)

        side = data.get("side")
        if side and side.upper() in ("BUY", "SELL"):
            side = side.upper()
        else:
            side = None

        time_period = data.get("time_period")
        normalized_query = data.get("normalized_query") or query
        confidence = float(data.get("confidence") or 0.75)
        reasoning = data.get("reasoning") or "LLM classification"

        print(f"[NLU v2] Intent={classification.value} | Tickers={merged_tickers} | "
              f"Qty={quantity} | Side={side} | Period={time_period} | "
              f"Confidence={confidence:.2f} | Reasoning: {reasoning[:80]}")

        return {
            "intent": classification,
            "tickers": merged_tickers,
            "quantity": quantity,
            "side": side,
            "time_period": time_period,
            "normalized_query": normalized_query,
            "confidence": confidence,
            "reasoning": reasoning,
        }

    except Exception as e:
        print(f"[NLU v2 Error] {e} — Falling back to keyword matching.")
        kw_result = keyword_classify(query)

        # Still apply local ticker pre-pass to keyword fallback
        merged = _merge_tickers(kw_result["tickers"], local_tickers)

        return {
            "intent": kw_result["intent"],
            "tickers": merged,
            "quantity": _extract_quantity_from_hindi(query),
            "side": None,
            "time_period": None,
            "normalized_query": query,
            "confidence": 0.5,
            "reasoning": "Fallback to keyword matching due to LLM error.",
        }
