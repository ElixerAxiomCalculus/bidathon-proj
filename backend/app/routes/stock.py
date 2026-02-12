from fastapi import APIRouter, HTTPException, Query

from app.models.stock import StockQuote, HistoryRecord, CompanyInfo, SearchResult
from app.services.yfinance.yf import (
    get_stock_quote,
    get_stock_history,
    get_company_info,
    search_ticker,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/search", response_model=list[SearchResult])
def search(q: str = Query(..., description="Company name or partial ticker")):
    """Search for stock tickers by company name or keyword."""
    try:
        return search_ticker(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/quote", response_model=StockQuote)
def quote(ticker: str):
    """Get the latest quote for a given stock ticker."""
    try:
        data = get_stock_quote(ticker)
        return StockQuote(**data)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found or error: {e}")


@router.get("/{ticker}/history", response_model=list[HistoryRecord])
def history(
    ticker: str,
    period: str = Query("1mo", description="1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
    interval: str = Query("1d", description="1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo"),
):
    """Get historical price data for a stock."""
    try:
        return get_stock_history(ticker, period=period, interval=interval)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not fetch history for '{ticker}': {e}")


@router.get("/{ticker}/info", response_model=CompanyInfo)
def info(ticker: str):
    """Get detailed company information."""
    try:
        data = get_company_info(ticker)
        return CompanyInfo(**data)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found or error: {e}")
