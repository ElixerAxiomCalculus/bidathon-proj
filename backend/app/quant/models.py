"""
Pydantic models for the Quant Trading Terminal.
"""

from pydantic import BaseModel, Field
from typing import Optional


class StrategyRunRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    strategy: str = Field(..., min_length=1)
    period: str = Field(default="6mo")
    interval: str = Field(default="1d")
    params: dict = Field(default_factory=dict)


class SignalPoint(BaseModel):
    date: str
    type: str  # BUY, SELL, STOP_LOSS, TAKE_PROFIT
    price: float
    label: Optional[str] = None


class StrategyMetrics(BaseModel):
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0
    profit_factor: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    risk_level: str = "MODERATE"
    confidence: float = 0.0
    verdict: str = ""
    suggested_position_pct: float = 0.0


class StrategyRunResponse(BaseModel):
    ticker: str
    strategy: str
    signals: list[SignalPoint]
    metrics: StrategyMetrics
    indicator_data: dict = Field(default_factory=dict)


class BacktestRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    strategy: str = Field(..., min_length=1)
    period: str = Field(default="1y")
    interval: str = Field(default="1d")
    initial_capital: float = Field(default=100000.0, gt=0)
    params: dict = Field(default_factory=dict)


class TradeRecord(BaseModel):
    date: str
    type: str
    price: float
    quantity: int
    pnl: float = 0.0
    cumulative_pnl: float = 0.0


class BacktestResponse(BaseModel):
    ticker: str
    strategy: str
    equity_curve: list[dict]
    trade_log: list[TradeRecord]
    metrics: StrategyMetrics
    initial_capital: float
    final_value: float
    total_return_pct: float


class DrawingItem(BaseModel):
    id: str
    type: str
    points: list[dict]
    style: dict = Field(default_factory=dict)


class DrawingSaveRequest(BaseModel):
    ticker: str
    drawings: list[DrawingItem]


class InsightRequest(BaseModel):
    ticker: str
    strategy: str
    metrics: dict
    signals_summary: dict = Field(default_factory=dict)
