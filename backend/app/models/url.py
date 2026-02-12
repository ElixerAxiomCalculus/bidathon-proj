from pydantic import BaseModel, HttpUrl
from typing import Optional


class UrlSubmission(BaseModel):
    urls: list[str]


class AuthenticityResult(BaseModel):
    url: str
    is_authentic: bool
    confidence: float
    category: Optional[str] = None
    reason: Optional[str] = None


class UrlCheckResponse(BaseModel):
    results: list[AuthenticityResult]
    saved: list[str]
    skipped_duplicates: list[str]


class UrlListResponse(BaseModel):
    urls: list[str]
    count: int
