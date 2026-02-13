"""
Pydantic models for the trading system.

Covers order requests, previews, portfolio responses, and all
DTOs between the API layer and the trading service.
"""

from pydantic import BaseModel, Field
from typing import Optional


class OrderPreviewRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    side: str = Field(..., pattern="^(BUY|SELL)$")
    quantity: int = Field(..., gt=0)


class OrderPreviewResponse(BaseModel):
    ticker: str
    side: str
    quantity: int
    current_price: float
    total_cost: float
    available_balance: float
    sufficient_funds: bool
    holdings_available: Optional[int] = None
    message: str


class OrderExecuteRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    side: str = Field(..., pattern="^(BUY|SELL)$")
    quantity: int = Field(..., gt=0)
    confirmed: bool = Field(default=True)


class OrderResponse(BaseModel):
    order_id: str
    ticker: str
    side: str
    quantity: int
    execution_price: float
    total_cost: float
    status: str
    timestamp: str
    message: str


class HoldingItem(BaseModel):
    ticker: str
    quantity: int
    average_price: float
    current_price: float
    invested_value: float
    current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float


class AllocationItem(BaseModel):
    ticker: str
    pct: float
    value: float


class PortfolioResponse(BaseModel):
    total_value: float
    cash_balance: float
    invested_amount: float
    current_holdings_value: float
    unrealized_pnl: float
    realized_pnl: float
    allocation: list[AllocationItem]
    holdings: list[HoldingItem]


class BalanceResponse(BaseModel):
    available_balance: float
    blocked_margin: float
    total_balance: float


class TradeItem(BaseModel):
    trade_id: str
    order_id: str
    ticker: str
    side: str
    quantity: int
    execution_price: float
    total_value: float
    pnl: Optional[float] = None
    timestamp: str


class OrderStatusItem(BaseModel):
    order_id: str
    ticker: str
    side: str
    quantity: int
    execution_price: float
    total_cost: float
    status: str
    timestamp: str
