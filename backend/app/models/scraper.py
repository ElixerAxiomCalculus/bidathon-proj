from pydantic import BaseModel
from typing import Optional


class ScrapeRequest(BaseModel):
    urls: list[str]


class ScrapedDocument(BaseModel):
    url: str
    title: str
    text: str


class ScrapeResultItem(BaseModel):
    url: str
    title: Optional[str] = None
    success: bool
    saved: bool
    error: Optional[str] = None


class ScrapeResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    results: list[ScrapeResultItem]


class DbStatsResponse(BaseModel):
    collection: str
    document_count: int
