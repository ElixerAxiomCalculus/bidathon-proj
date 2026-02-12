"""
Intent Classifier — keyword-based routing + ticker extraction.

Classifies user queries into one of 8 intents and extracts
stock ticker symbols from the query text.
"""

from enum import Enum
import re


class Intent(str, Enum):
    STOCK_QUOTE = "stock_quote"
    STOCK_ANALYSIS = "stock_analysis"
    FINANCIAL_EDUCATION = "financial_education"
    LOAN_QUERY = "loan_query"
    MARKET_STATUS = "market_status"
    NEWS_QUERY = "news_query"
    CALCULATOR = "calculator"
    GENERAL_FINANCE = "general_finance"


# ── Keyword → Intent Mapping ─────────────────────────────────────────────────

_INTENT_KEYWORDS: dict[Intent, list[str]] = {
    Intent.STOCK_QUOTE: [
        "price", "quote", "stock price", "how much is", "current price",
        "share price", "trading at", "what is the price", "cost of",
    ],
    Intent.STOCK_ANALYSIS: [
        "should i buy", "should i sell", "should i invest", "analyze",
        "analysis", "recommendation", "outlook", "forecast", "predict",
        "undervalued", "overvalued", "bullish", "bearish", "hold",
        "good investment", "worth buying", "target price",
    ],
    Intent.FINANCIAL_EDUCATION: [
        "what is a", "what are", "explain", "define", "meaning of",
        "how does", "how do", "difference between", "types of",
        "basics of", "introduction to", "learn about", "tell me about",
        "what is mutual fund", "what is sip", "what is emi", "what is stock",
        "what is bond", "what is etf", "what is nifty", "what is sensex",
        "what is dividend", "what is pe ratio", "what is market cap",
        "what is inflation", "what is gdp", "what is recession",
    ],
    Intent.LOAN_QUERY: [
        "loan", "emi", "interest rate", "mortgage", "home loan",
        "car loan", "personal loan", "repayment", "tenure",
        "borrow", "lending", "credit", "installment",
    ],
    Intent.MARKET_STATUS: [
        "market", "how is the market", "market today", "market overview",
        "market status", "indices", "nifty", "sensex", "s&p", "nasdaq",
        "dow jones", "market doing", "market performance", "bull market",
        "bear market", "market crash", "market rally",
    ],
    Intent.NEWS_QUERY: [
        "news", "latest", "headline", "update", "report",
        "announcement", "breaking", "recent", "happening",
    ],
    Intent.CALCULATOR: [
        "calculate", "calculator", "compute", "sip calculator",
        "emi calculator", "compound interest", "how much will i get",
        "returns on", "investment returns", "sip returns",
        "monthly installment", "compounding",
    ],
}


# ── Common English Words to Skip (Prevents False Ticker Matches) ─────────────

_KNOWN_WORDS = {
    "I", "A", "AN", "AM", "AS", "AT", "BE", "BY", "DO", "GO", "IF", "IN",
    "IS", "IT", "ME", "MY", "NO", "OF", "OK", "ON", "OR", "SO", "TO", "UP",
    "US", "WE", "HE", "ALL", "AND", "ANY", "ARE", "ASK", "BIG", "BUY",
    "CAN", "DAY", "DID", "FOR", "GET", "GOT", "HAS", "HAD", "HER", "HIM",
    "HIS", "HOW", "ITS", "LET", "LOT", "MAY", "NEW", "NOT", "NOW", "OLD",
    "ONE", "OUR", "OUT", "OWN", "PER", "PUT", "SAY", "SHE", "THE", "TOO",
    "TWO", "USE", "WAY", "WHO", "WHY", "WIN", "WON", "YES", "YET", "YOU",
    "GOOD", "BEST", "HIGH", "LONG", "MUCH", "NEXT", "OVER", "SOME", "TELL",
    "THAN", "THAT", "THEM", "THEN", "THEY", "THIS", "TIME", "VERY", "WANT",
    "WELL", "WHAT", "WHEN", "WILL", "WITH", "YEAR", "YOUR", "FROM", "HAVE",
    "HERE", "INTO", "JUST", "LIKE", "LOOK", "MAKE", "MORE", "MOST", "ONLY",
    "VERY", "ALSO", "BACK", "BEEN", "CALL", "COME", "EACH", "EVEN", "FIND",
    "GIVE", "HAND", "KEEP", "LAST", "LIFE", "MANY", "MUST", "NAME", "PART",
    "TAKE", "WORK", "DOES", "FUND", "RATE", "RISK",
    "ABOUT", "AFTER", "BEING", "COULD", "EVERY", "FIRST", "GREAT",
    "MONEY", "STOCK", "PRICE", "SHARE", "VALUE", "WORTH", "THINK",
    "WHICH", "WOULD", "THEIR", "THERE", "THESE", "THOSE", "SHOULD",
    "MARKET", "INVEST", "RETURN", "TRADE", "POINT", "WHERE",
    "STILL", "TOTAL", "UNDER",
    # Financial terms that look like tickers
    "SIP", "EMI", "ETF", "IPO", "NAV", "GDP", "ROI", "ROE", "EPS",
    "PE", "FD", "RD", "PPF", "NPS", "APR", "APY",
}


def classify_intent(query: str) -> Intent:
    """Classify a query into one of the supported intents using keyword matching."""
    lower = query.lower()

    # Score each intent by counting keyword matches
    scores: dict[Intent, int] = {}
    for intent, keywords in _INTENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in lower)
        if score > 0:
            scores[intent] = score

    if scores:
        return max(scores, key=scores.get)

    return Intent.GENERAL_FINANCE


def extract_tickers(query: str) -> list[str]:
    """
    Extract potential stock ticker symbols from the query.

    Rules:
    - 1–5 uppercase letters
    - Not a common English word
    - Can handle formats like: AAPL, $AAPL, AAPL?, "AAPL"
    """
    # Match $TICKER or standalone UPPERCASE words
    pattern = r'\$?([A-Z]{1,5})\b'
    candidates = re.findall(pattern, query)

    # Also try to extract from mixed case (e.g., "Apple" → search for ticker)
    # But we primarily rely on uppercase matches

    tickers = []
    seen = set()
    for c in candidates:
        upper = c.upper()
        if upper not in _KNOWN_WORDS and upper not in seen:
            seen.add(upper)
            tickers.append(upper)

    return tickers


def classify(query: str) -> dict:
    """
    Full classification: returns intent + extracted tickers.

    Returns:
        {"intent": Intent, "tickers": list[str]}
    """
    intent = classify_intent(query)
    tickers = extract_tickers(query)
    return {"intent": intent, "tickers": tickers}
