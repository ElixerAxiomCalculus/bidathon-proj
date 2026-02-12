from pydantic import BaseModel, Field
from typing import Optional


class StockQuote(BaseModel):
    ticker: str
    name: Optional[str] = None
    price: Optional[float] = None
    previous_close: Optional[float] = None
    open: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    volume: Optional[int] = None
    market_cap: Optional[int] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    week_52_high: Optional[float] = Field(None, alias="52_week_high")
    week_52_low: Optional[float] = Field(None, alias="52_week_low")
    currency: Optional[str] = None
    exchange: Optional[str] = None

    model_config = {"populate_by_name": True}


class HistoryRecord(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class CompanyInfo(BaseModel):
    ticker: str
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    employees: Optional[int] = None
    market_cap: Optional[int] = None
    enterprise_value: Optional[int] = None


class SearchResult(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    exchange: Optional[str] = None
    type: Optional[str] = None
