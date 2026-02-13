"""
Quant Trading Terminal API routes.

Provides endpoints for:
  - Strategy listing and execution
  - Backtesting
  - AI insight generation
  - Drawing persistence (MongoDB)
  - WebSocket live price streaming
"""

from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, WebSocket

from app.auth.deps import get_current_user
from app.services.yfinance.yf import get_stock_history
from app.services.openai_llm import chat_completion
from app.tools.db import db
from app.quant.strategies import list_strategies, run_strategy
from app.quant.backtester import run_backtest
from app.quant.ws import live_price_stream
from app.quant.models import (
    StrategyRunRequest,
    BacktestRequest,
    DrawingSaveRequest,
    InsightRequest,
)

router = APIRouter(prefix="/quant", tags=["quant"])


def _fetch_ohlcv(ticker: str, period: str, interval: str) -> pd.DataFrame:
    """Fetch OHLCV data and convert to DataFrame."""
    history = get_stock_history(ticker, period=period, interval=interval)
    if not history:
        raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
    df = pd.DataFrame(history)
    return df


# ─── Strategy Endpoints ────────────────────────────────────

@router.get("/strategies")
def get_strategies():
    """List all available quant strategies with metadata."""
    return {"strategies": list_strategies()}


@router.post("/run")
def run_strategy_endpoint(body: StrategyRunRequest, user=Depends(get_current_user)):
    """Run a strategy on a stock and return signals + metrics."""
    try:
        df = _fetch_ohlcv(body.ticker, body.period, body.interval)
        result = run_strategy(body.strategy, df, body.params)
        return {
            "ticker": body.ticker.upper(),
            "strategy": body.strategy,
            "signals": result["signals"],
            "metrics": result["metrics"],
            "indicator_data": result.get("indicator_data", {}),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Strategy execution failed: {e}")


# ─── Backtest Endpoint ─────────────────────────────────────

@router.post("/backtest")
def backtest_endpoint(body: BacktestRequest, user=Depends(get_current_user)):
    """Run a full backtest with equity curve and trade log."""
    try:
        df = _fetch_ohlcv(body.ticker, body.period, body.interval)
        strategy_result = run_strategy(body.strategy, df, body.params)
        backtest_result = run_backtest(df, strategy_result["signals"], body.initial_capital)
        return {
            "ticker": body.ticker.upper(),
            "strategy": body.strategy,
            **backtest_result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {e}")


# ─── AI Insight Generation ─────────────────────────────────

INSIGHT_SYSTEM_PROMPT = """You are a senior quantitative analyst at an institutional trading desk.
Generate a concise, professional market analysis based on the strategy execution results provided.
Use precise quantitative language. Reference specific metrics. Avoid colloquial expressions.
Sound like an internal research note from a hedge fund quant team.
Do not use any emojis or icons. Keep the tone clinical and data-driven.
Structure: 1-2 sentence market regime assessment, 1-2 sentence strategy performance summary,
1 sentence risk assessment, 1 sentence actionable conclusion.
Maximum 150 words. No disclaimers in the insight body."""


@router.post("/insight")
def generate_insight(body: InsightRequest, user=Depends(get_current_user)):
    """Generate AI institutional-style insight from strategy results."""
    try:
        user_prompt = (
            f"Ticker: {body.ticker}\n"
            f"Strategy: {body.strategy}\n"
            f"Metrics: {body.metrics}\n"
            f"Signals Summary: {body.signals_summary}\n"
        )
        insight = chat_completion(INSIGHT_SYSTEM_PROMPT, user_prompt)
        return {
            "ticker": body.ticker,
            "strategy": body.strategy,
            "insight": insight,
            "disclaimer": "This analysis is algorithmically generated and does not constitute financial advice. "
                          "Past performance is not indicative of future results. All trading involves risk.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insight generation failed: {e}")


# ─── Drawing Persistence ───────────────────────────────────

@router.get("/drawings/{ticker}")
def get_drawings(ticker: str, user=Depends(get_current_user)):
    """Load saved chart drawings for a ticker."""
    doc = db["quant_drawings"].find_one(
        {"user_email": user["email"], "ticker": ticker.upper()},
        {"_id": 0, "drawings": 1},
    )
    return {"ticker": ticker.upper(), "drawings": doc.get("drawings", []) if doc else []}


@router.post("/drawings")
def save_drawings(body: DrawingSaveRequest, user=Depends(get_current_user)):
    """Save/update chart drawings for a ticker."""
    db["quant_drawings"].update_one(
        {"user_email": user["email"], "ticker": body.ticker.upper()},
        {
            "$set": {
                "drawings": [d.model_dump() for d in body.drawings],
                "updated_at": datetime.utcnow().isoformat(),
            },
            "$setOnInsert": {
                "user_email": user["email"],
                "ticker": body.ticker.upper(),
            },
        },
        upsert=True,
    )
    return {"message": "Drawings saved", "ticker": body.ticker.upper()}


@router.delete("/drawings/{ticker}")
def delete_drawings(ticker: str, user=Depends(get_current_user)):
    """Clear all drawings for a ticker."""
    db["quant_drawings"].delete_one(
        {"user_email": user["email"], "ticker": ticker.upper()}
    )
    return {"message": "Drawings cleared", "ticker": ticker.upper()}


# ─── WebSocket ──────────────────────────────────────────────

@router.websocket("/ws/live/{ticker}")
async def websocket_live(websocket: WebSocket, ticker: str):
    """WebSocket endpoint for live price streaming."""
    await live_price_stream(websocket, ticker)
