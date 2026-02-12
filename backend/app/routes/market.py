"""
Market overview route — live dashboard data.
"""

from fastapi import APIRouter, Query

from app.models.agent import MarketItem, TrendResponse
from app.services.yfinance.market import get_market_overview
from app.services.yfinance.yf import get_stock_history
from app.services.yfinance.trend import analyze_trend

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/overview", response_model=list[MarketItem])
def market_overview():
    """
    Get live prices for major market indices and assets:
    S&P 500, NASDAQ, Dow Jones, NIFTY 50, SENSEX, BTC, Gold, Crude Oil.
    """
    return get_market_overview()


@router.get("/trend/{ticker}", response_model=TrendResponse)
def ticker_trend(
    ticker: str,
    period: str = Query("1mo", description="1d, 5d, 1mo, 3mo, 6mo, 1y"),
    interval: str = Query("1d", description="1d, 1wk, 1mo"),
):
    """
    Get trend analysis (direction, volatility, support/resistance) for any ticker.
    """
    history = get_stock_history(ticker, period=period, interval=interval)
    return analyze_trend(history)
