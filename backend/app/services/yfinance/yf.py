from datetime import datetime, timedelta
from typing import Optional
import requests
import yfinance as yf


def _get_session():
    """Create a session with a browser User-Agent and prime cookies."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/",
    })
    # Prime cookies by visiting the homepage
    try:
        session.get("https://finance.yahoo.com", timeout=5)
    except Exception:
        pass # Ignore initialization errors, yfinance might still work or fail gracefully later
    return session


def get_stock_quote(ticker: str) -> dict:
    """Get the current/latest quote for a stock ticker."""
    session = _get_session()
    stock = yf.Ticker(ticker, session=session)
    info = stock.info

    return {
        "ticker": ticker.upper(),
        "name": info.get("shortName") or info.get("longName"),
        "price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "previous_close": info.get("previousClose"),
        "open": info.get("open") or info.get("regularMarketOpen"),
        "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
        "day_low": info.get("dayLow") or info.get("regularMarketDayLow"),
        "volume": info.get("volume") or info.get("regularMarketVolume"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "dividend_yield": info.get("dividendYield"),
        "52_week_high": info.get("fiftyTwoWeekHigh"),
        "52_week_low": info.get("fiftyTwoWeekLow"),
        "currency": info.get("currency"),
        "exchange": info.get("exchange"),
    }


def get_stock_history(
    ticker: str,
    period: str = "1mo",
    interval: str = "1d",
) -> list[dict]:
    """
    Get historical price data for a stock.

    period  : 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    interval: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
    """
    session = _get_session()
    stock = yf.Ticker(ticker, session=session)
    hist = stock.history(period=period, interval=interval)

    records = []
    for date, row in hist.iterrows():
        records.append({
            "date": str(date),
            "open": round(row["Open"], 2),
            "high": round(row["High"], 2),
            "low": round(row["Low"], 2),
            "close": round(row["Close"], 2),
            "volume": int(row["Volume"]),
        })
    return records


def get_company_info(ticker: str) -> dict:
    """Get detailed company information."""
    session = _get_session()
    stock = yf.Ticker(ticker, session=session)
    info = stock.info

    return {
        "ticker": ticker.upper(),
        "name": info.get("shortName") or info.get("longName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "country": info.get("country"),
        "website": info.get("website"),
        "description": info.get("longBusinessSummary"),
        "employees": info.get("fullTimeEmployees"),
        "market_cap": info.get("marketCap"),
        "enterprise_value": info.get("enterpriseValue"),
    }


def search_ticker(query: str) -> list[dict]:
    """Search for a stock ticker by company name or partial ticker."""
    # yf.Search does not readily accept a session in all versions, 
    # but strictly speaking user-agent might be less critical for search 
    # or it might share global config. 
    # However, newer yfinance uses `requests` internally.
    # We can try to rely on yf.Ticker's session passing or global override if needed.
    # For now, let's just use it as is, or use the Ticker class if possible.
    # yf.Search is distinct. Let's try to monkeypatch or just leave it if it works locally.
    # Actually, let's keep it simple for search as it might be using a different endpoint.
    search = yf.Search(query, max_results=10)
    quotes = search.quotes
    return [
        {
            "symbol": q.get("symbol"),
            "name": q.get("shortname") or q.get("longname"),
            "exchange": q.get("exchDisp") or q.get("exchange"),
            "type": q.get("quoteType"),
        }
        for q in quotes
    ]