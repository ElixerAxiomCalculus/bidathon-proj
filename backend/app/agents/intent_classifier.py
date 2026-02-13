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
    TRADE_ORDER = "trade_order"
    STOCK_CHART = "stock_chart"
    GENERAL_FINANCE = "general_finance"


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
    Intent.TRADE_ORDER: [
        "buy shares", "sell shares", "buy stock", "sell stock",
        "place order", "execute trade", "purchase shares",
        "buy 1", "buy 2", "buy 3", "buy 4", "buy 5",
        "buy 10", "buy 20", "buy 50", "buy 100",
        "sell 1", "sell 2", "sell 3", "sell 4", "sell 5",
        "sell 10", "sell 20", "sell 50", "sell 100",
        "i want to buy", "i want to sell",
        "invest in", "start trading",
        "my holdings", "my portfolio", "my balance",
        "show portfolio", "show holdings", "show balance",
        "trade history", "my trades", "order history",
    ],
    Intent.STOCK_CHART: [
        "chart", "graph", "plot", "visual", "visualize",
        "show me", "display", "trend chart", "price chart",
        "candlestick", "line chart", "show graph",
        "last 5 days", "last 7 days", "last 1 month", "last 3 months",
        "past week", "past month", "historical chart",
        "price history graph", "real time", "realtime",
        "show trend", "show price",
    ],
}


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
    "SELL", "SHARES", "HOLD", "EXIT", "ORDER", "PLACE", "EXECUTE",
    "PURCHASE", "BUYING", "SELLING", "TRADING", "BOUGHT", "SOLD",
    "SHOW", "DISPLAY", "CHART", "GRAPH", "PLOT", "VISUAL", "TREND",
    "MONTHLY", "WEEKLY", "DAILY", "YEARLY", "VARIATION", "HISTORY",
    "PORTFOLIO", "HOLDINGS", "BALANCE", "DEMAT", "BROKER",
    "ANALYZE", "ANALYSIS", "PREDICT", "FORECAST", "OUTLOOK",
    "BULLISH", "BEARISH", "TARGET", "CURRENT", "REAL",
    "SIP", "EMI", "ETF", "IPO", "NAV", "GDP", "ROI", "ROE", "EPS",
    "PE", "FD", "RD", "PPF", "NPS", "APR", "APY",
    # Financial / wallet / account words
    "WALLET", "REMAINING", "LEFT", "AMOUNT", "SPEND", "SPENT",
    "DEPOSIT", "WITHDRAW", "PAYMENT", "TRANSFER", "ACCOUNT",
    "AVAILABLE", "FUNDS", "CASH", "DEBIT", "CREDIT", "CARD",
    "PAY", "PAID", "PAYING", "INVEST", "INVESTING", "INVESTED",
    "PROFIT", "LOSS", "GAINS", "LOSSES", "EARNING", "EARNINGS",
    "INCOME", "EXPENSE", "BUDGET", "SAVE", "SAVING", "SAVINGS",
    # Action / query words
    "PLEASE", "GIVE", "GENERATE", "CREATE", "FETCH", "CHECK",
    "VIEW", "OPEN", "CLOSE", "START", "STOP", "HELP", "NEED",
    "WANT", "USING", "USED", "WORTH", "REMAINING", "LEFT",
    "RIGHT", "TOP", "BOTTOM", "LIST", "DATA", "INFO",
    # Time / misc words
    "TODAY", "YESTERDAY", "TOMORROW", "WEEK", "MONTH", "HOUR",
    "MINUTE", "SECOND", "MORNING", "EVENING", "NIGHT", "PAST",
    "FUTURE", "RECENT", "LATEST", "AGO", "SINCE", "UNTIL",
    # Common verbs / adjectives
    "MEAN", "MEANS", "KNOW", "DOES", "DONT", "WONT", "CANT",
    "BEEN", "DONE", "MADE", "WENT", "CAME", "SAID", "TOLD",
    "GAVE", "TOOK", "CAME", "LEFT", "SENT", "FULL", "FREE",
    "SAME", "BOTH", "SUCH", "REAL", "TRUE", "FALSE", "WRONG",
    "COMPARE", "VERSUS", "BETWEEN", "AGAINST", "ABOVE", "BELOW",
    # Pre/post trade words
    "QUANTITY", "QTY", "LOT", "LOTS", "UNIT", "UNITS",
    "CONFIRM", "PREVIEW", "REVIEW", "SUBMIT", "CANCEL",
    "PENDING", "FILLED", "REJECTED", "COMPLETED", "STATUS",
    "STOP", "LIMIT", "TRIGGER", "MARGIN", "LEVERAGE",
    "INTRADAY", "DELIVERY", "SWING", "POSITION", "ENTRY",
}


def classify_intent(query: str) -> Intent:
    """Classify a query into one of the supported intents using keyword matching."""
    lower = query.lower()

    # Mode-forced prefixes from frontend mode selector
    if lower.startswith("[trade]"):
        return Intent.TRADE_ORDER
    if lower.startswith("[chart]"):
        return Intent.STOCK_CHART
    if lower.startswith("[advisor]"):
        return Intent.STOCK_ANALYSIS

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
    - 1–10 letters (case-insensitive)
    - Not a common English word
    - Can handle formats like: AAPL, $AAPL, reliance, Reliance
    """
    # Strip mode prefix before extraction
    cleaned = re.sub(r'^\[(?:TRADE|CHART)\]\s*', '', query, flags=re.IGNORECASE)
    pattern = r'\b\$?([A-Za-z]{1,10})\b'
    candidates = re.findall(pattern, cleaned)

    tickers = []
    seen = set()
    for c in candidates:
        upper = c.upper()
        if upper not in _KNOWN_WORDS and upper not in seen and len(upper) >= 2:
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
