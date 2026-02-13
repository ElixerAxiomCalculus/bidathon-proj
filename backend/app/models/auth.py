"""
Pydantic models for the auth system — signup, login, OTP, profile,
watchlist, conversations.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str


class SignupResponse(BaseModel):
    message: str
    email: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OtpLoginInitRequest(BaseModel):
    email: EmailStr


class LoginResponse(BaseModel):
    message: str
    email: str
    token: Optional[str] = None
    user: Optional[dict] = None


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class OtpVerifyResponse(BaseModel):
    message: str
    token: str
    user: dict


class ResendOtpRequest(BaseModel):
    email: EmailStr


class UserProfile(BaseModel):
    name: str
    email: str
    phone: str
    watchlist: list[str] = []
    chat_count: int = 0
    created_at: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class WatchlistUpdateRequest(BaseModel):
    """Replace the entire watchlist (max 10)."""
    tickers: list[str]


class WatchlistAddRequest(BaseModel):
    ticker: str


class WatchlistRemoveRequest(BaseModel):
    ticker: str


class ConversationSummary(BaseModel):
    id: str
    title: str
    preview: str = ""
    message_count: int = 0
    updated_at: Optional[str] = None


class ConversationDetail(BaseModel):
    id: str
    title: str
    messages: list[dict] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
