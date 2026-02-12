"""
Market Overview — live prices for major indices and assets.
"""

import yfinance as yf


_TRACKED_ASSETS = [
    ("S&P 500", "^GSPC"),
    ("NASDAQ", "^IXIC"),
    ("Dow Jones", "^DJI"),
    ("NIFTY 50", "^NSEI"),
    ("SENSEX", "^BSESN"),
    ("Bitcoin", "BTC-USD"),
    ("Gold", "GC=F"),
    ("Crude Oil", "CL=F"),
]


def get_market_overview() -> list[dict]:
    """
    Fetch live snapshot for 8 major market indices / assets.

    Returns list of:
        { name, ticker, price, previous_close, change, change_pct, currency }
    """
    results = []
    for name, ticker in _TRACKED_ASSETS:
        try:
            t = yf.Ticker(ticker)
            info = t.info
            price = info.get("currentPrice") or info.get("regularMarketPrice")
            prev = info.get("previousClose")
            change = round(price - prev, 2) if price and prev else None
            change_pct = round((change / prev) * 100, 2) if change and prev else None

            results.append({
                "name": name,
                "ticker": ticker,
                "price": round(price, 2) if price else None,
                "previous_close": round(prev, 2) if prev else None,
                "change": change,
                "change_pct": change_pct,
                "currency": info.get("currency", "USD"),
            })
        except Exception:
            results.append({
                "name": name,
                "ticker": ticker,
                "price": None,
                "previous_close": None,
                "change": None,
                "change_pct": None,
                "currency": "USD",
            })
    return results
