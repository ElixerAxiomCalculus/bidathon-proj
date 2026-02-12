from pydantic import BaseModel
from typing import Optional


# ── Agent ────────────────────────────────────────────────────────────────────

class AgentQueryRequest(BaseModel):
    query: str
    user_id: str = "anonymous"


class AgentQueryResponse(BaseModel):
    response: str
    intent: str
    tools_used: list[str]
    tickers: list[str]


# ── Calculators ──────────────────────────────────────────────────────────────

class SipRequest(BaseModel):
    monthly_investment: float
    annual_return_rate: float
    years: int


class SipResponse(BaseModel):
    monthly_investment: float
    annual_return_rate: float
    years: int
    total_months: int
    total_invested: float
    estimated_returns: float
    total_value: float


class EmiRequest(BaseModel):
    principal: float
    annual_interest_rate: float
    tenure_months: int


class EmiResponse(BaseModel):
    principal: float
    annual_interest_rate: float
    tenure_months: int
    emi: float
    total_payment: float
    total_interest: float


class CompoundRequest(BaseModel):
    principal: float
    annual_rate: float
    years: int
    compounding_frequency: int = 12


class CompoundResponse(BaseModel):
    principal: float
    annual_rate: float
    years: int
    compounding_frequency: int
    final_amount: float
    interest_earned: float
    effective_annual_rate: float


# ── Market Overview ──────────────────────────────────────────────────────────

class MarketItem(BaseModel):
    name: str
    ticker: str
    price: Optional[float] = None
    previous_close: Optional[float] = None
    change: Optional[float] = None
    change_pct: Optional[float] = None
    currency: str = "USD"


# ── Trend ────────────────────────────────────────────────────────────────────

class TrendResponse(BaseModel):
    direction: str
    volatility_score: float
    price_change_pct: float
    avg_volume: int
    support: float
    resistance: float
    summary: str
