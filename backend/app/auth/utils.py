"""
Auth utilities — JWT tokens, password hashing, OTP generation (pyotp).
"""

import os
import time
from datetime import datetime, timedelta, timezone

import pyotp
from dotenv import load_dotenv
from jose import jwt, JWTError
import bcrypt

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SECRET_KEY = os.getenv("JWT_SECRET", "b1d@th0n-f1n@lly-s3cret-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_hours: int = ACCESS_TOKEN_EXPIRE_HOURS) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload dict or None."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


OTP_TTL_SECONDS = 300

_OTP_SECRET = os.getenv("OTP_SECRET", pyotp.random_base32())


def generate_otp() -> tuple[str, float]:
    """Generate a 6-digit OTP using pyotp and return (code, expiry_timestamp)."""
    totp = pyotp.TOTP(_OTP_SECRET, digits=6, interval=OTP_TTL_SECONDS)
    code = totp.now()
    expiry = time.time() + OTP_TTL_SECONDS
    return code, expiry


def verify_otp(stored_otp: str, stored_expiry: float, submitted_otp: str) -> bool:
    """Check OTP matches and hasn't expired."""
    if time.time() > stored_expiry:
        return False
    return stored_otp == submitted_otp
