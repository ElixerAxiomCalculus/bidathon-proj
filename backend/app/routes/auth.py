"""
Auth routes — signup, login, OTP verification, profile management,
watchlist CRUD, and conversation persistence.

All protected routes require a valid JWT Bearer token.
"""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.utils import (
    hash_password,
    verify_password,
    create_access_token,
    generate_otp,
    verify_otp,
)
from app.auth.deps import get_current_user
from app.models.auth import (
    SignupRequest, SignupResponse,
    LoginRequest, LoginResponse,
    OtpLoginInitRequest,
    OtpVerifyRequest, OtpVerifyResponse,
    ResendOtpRequest,
    UserProfile, UpdateProfileRequest, ChangePasswordRequest,
    WatchlistUpdateRequest, WatchlistAddRequest,
    ConversationSummary, ConversationDetail,
)
from app.services.email import send_otp_email
from app.tools.db import db

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_WATCHLIST = 10


@router.post("/signup", response_model=SignupResponse)
def signup(body: SignupRequest):
    """Register a new user. Sends OTP via email for 2FA verification."""
    if db["users"].find_one({"email": body.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    otp_code, otp_expiry = generate_otp()

    user_doc = {
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "is_verified": False,
        "otp": otp_code,
        "otp_expiry": otp_expiry,
        "watchlist": [],
        "wallet_balance": 10_000_000.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db["users"].insert_one(user_doc)

    send_otp_email(body.email, otp_code, purpose="verification")

    return SignupResponse(message="Account created. Please verify the OTP sent to your email.", email=body.email)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    """
    Authenticate user with email + password.
    If account is already verified, returns a JWT token directly.
    If not verified, sends a new OTP via email.
    """
    user = db["users"].find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("is_verified"):
        token = create_access_token({"sub": user["email"]})
        return LoginResponse(
            message="Login successful",
            email=user["email"],
            token=token,
            user={"name": user["name"], "email": user["email"]},
        )

    otp_code, otp_expiry = generate_otp()
    db["users"].update_one(
        {"email": body.email},
        {"$set": {"otp": otp_code, "otp_expiry": otp_expiry}},
    )
    send_otp_email(body.email, otp_code, purpose="login")

    return LoginResponse(message="OTP sent to your email for verification", email=body.email)


@router.post("/login-otp", response_model=LoginResponse)
def login_otp_init(body: OtpLoginInitRequest):
    """
    Initiate passwordless login via OTP.
    """
    user = db["users"].find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp_code, otp_expiry = generate_otp()
    db["users"].update_one(
        {"email": body.email},
        {"$set": {"otp": otp_code, "otp_expiry": otp_expiry}},
    )
    send_otp_email(body.email, otp_code, purpose="login")

    return LoginResponse(
        message="OTP sent to your email",
        email=body.email
    )


@router.post("/verify-otp", response_model=OtpVerifyResponse)
def verify_otp_route(body: OtpVerifyRequest):
    """Verify OTP to complete 2FA. Returns JWT on success."""
    user = db["users"].find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_otp(user.get("otp", ""), user.get("otp_expiry", 0), body.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    db["users"].update_one(
        {"email": body.email},
        {"$set": {"is_verified": True}, "$unset": {"otp": "", "otp_expiry": ""}},
    )

    token = create_access_token({"sub": user["email"]})
    return OtpVerifyResponse(
        message="Verification successful",
        token=token,
        user={"name": user["name"], "email": user["email"]},
    )


@router.post("/resend-otp")
def resend_otp(body: ResendOtpRequest):
    """Regenerate and resend OTP via email."""
    user = db["users"].find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp_code, otp_expiry = generate_otp()
    db["users"].update_one(
        {"email": body.email},
        {"$set": {"otp": otp_code, "otp_expiry": otp_expiry}},
    )
    send_otp_email(body.email, otp_code, purpose="resend")
    return {"message": "New OTP sent to your email", "email": body.email}


@router.get("/profile", response_model=UserProfile)
def get_profile(user: dict = Depends(get_current_user)):
    """Return the logged-in user's profile data."""
    chat_count = db["conversations"].count_documents({"user_email": user["email"]})
    return UserProfile(
        name=user["name"],
        email=user["email"],
        phone=user.get("phone", ""),
        watchlist=user.get("watchlist", []),
        chat_count=chat_count,
        created_at=user.get("created_at"),
    )


@router.put("/profile")
def update_profile(body: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    """Update name and/or phone."""
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.phone is not None:
        updates["phone"] = body.phone
    if not updates:
        return {"message": "Nothing to update"}
    db["users"].update_one({"email": user["email"]}, {"$set": updates})
    return {"message": "Profile updated"}


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    """Change password (requires current password)."""
    full_user = db["users"].find_one({"email": user["email"]})
    if not verify_password(body.current_password, full_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    db["users"].update_one(
        {"email": user["email"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    return {"message": "Password changed successfully"}


@router.delete("/account")
def delete_account(user: dict = Depends(get_current_user)):
    """Permanently delete account and all associated data."""
    email = user["email"]
    db["users"].delete_one({"email": email})
    db["conversations"].delete_many({"user_email": email})
    db["user_sessions"].delete_many({"user_id": email})
    return {"message": "Account permanently deleted"}


@router.get("/watchlist")
def get_watchlist(user: dict = Depends(get_current_user)):
    """Get the user's watchlist."""
    return {"watchlist": user.get("watchlist", [])}


@router.put("/watchlist")
def set_watchlist(body: WatchlistUpdateRequest, user: dict = Depends(get_current_user)):
    """Replace the entire watchlist (max 10, deduplicated, uppercased)."""
    tickers = list(dict.fromkeys(t.upper() for t in body.tickers))[:MAX_WATCHLIST]
    db["users"].update_one({"email": user["email"]}, {"$set": {"watchlist": tickers}})
    return {"watchlist": tickers}


@router.post("/watchlist/add")
def add_to_watchlist(body: WatchlistAddRequest, user: dict = Depends(get_current_user)):
    """Add a single ticker to the watchlist."""
    current = user.get("watchlist", [])
    ticker = body.ticker.upper()
    if ticker in current:
        return {"message": "Already in watchlist", "watchlist": current}
    if len(current) >= MAX_WATCHLIST:
        raise HTTPException(status_code=400, detail=f"Watchlist limit reached ({MAX_WATCHLIST})")
    current.append(ticker)
    db["users"].update_one({"email": user["email"]}, {"$set": {"watchlist": current}})
    return {"message": f"Added {ticker}", "watchlist": current}


@router.delete("/watchlist/{ticker:path}")
def remove_from_watchlist(ticker: str, user: dict = Depends(get_current_user)):
    """Remove a ticker from the watchlist (idempotent)."""
    current = user.get("watchlist", [])
    upper = ticker.upper()
    if upper in current:
        current.remove(upper)
        db["users"].update_one({"email": user["email"]}, {"$set": {"watchlist": current}})
    return {"message": f"Removed {upper}", "watchlist": current}


@router.get("/wallet")
def get_wallet(user: dict = Depends(get_current_user)):
    """Get the user's wallet balance."""
    full = db["users"].find_one({"email": user["email"]})
    balance = full.get("wallet_balance")
    if balance is None:
        balance = 10_000_000.0
        db["users"].update_one({"email": user["email"]}, {"$set": {"wallet_balance": balance}})
    return {"wallet_balance": balance}


@router.post("/wallet/add")
def add_wallet_funds(body: dict, user: dict = Depends(get_current_user)):
    """Add funds to the user's wallet (simulated payment)."""
    amount = body.get("amount", 0)
    if not isinstance(amount, (int, float)) or amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    if amount > 100_000_000:
        raise HTTPException(status_code=400, detail="Maximum single deposit is ₹10 Cr")
    full = db["users"].find_one({"email": user["email"]})
    current = full.get("wallet_balance", 10_000_000.0)
    new_balance = round(current + amount, 2)
    db["users"].update_one({"email": user["email"]}, {"$set": {"wallet_balance": new_balance}})
    from app.trading.paper_broker import wallets
    wallets.update_one(
        {"user_id": user["email"]},
        {"$set": {"balance": new_balance}},
        upsert=True,
    )
    return {"message": f"₹{amount:,.2f} added successfully", "wallet_balance": new_balance}


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(user: dict = Depends(get_current_user)):
    """List all conversations for the user, newest first."""
    convos = list(
        db["conversations"]
        .find({"user_email": user["email"]}, {"messages": 0})
        .sort("updated_at", -1)
    )
    result = []
    for c in convos:
        result.append(ConversationSummary(
            id=str(c["_id"]),
            title=c.get("title", "Untitled"),
            preview=c.get("preview", ""),
            message_count=c.get("message_count", 0),
            updated_at=c.get("updated_at"),
        ))
    return result


@router.post("/conversations", response_model=ConversationSummary)
def create_conversation(user: dict = Depends(get_current_user)):
    """Create a new empty conversation."""
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_email": user["email"],
        "title": "New Conversation",
        "preview": "",
        "messages": [],
        "message_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    result = db["conversations"].insert_one(doc)
    return ConversationSummary(
        id=str(result.inserted_id),
        title="New Conversation",
        preview="",
        message_count=0,
        updated_at=now,
    )


@router.get("/conversations/{convo_id}", response_model=ConversationDetail)
def get_conversation(convo_id: str, user: dict = Depends(get_current_user)):
    """Get a single conversation with all messages."""
    try:
        oid = ObjectId(convo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    convo = db["conversations"].find_one({"_id": oid, "user_email": user["email"]})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationDetail(
        id=str(convo["_id"]),
        title=convo.get("title", "Untitled"),
        messages=convo.get("messages", []),
        created_at=convo.get("created_at"),
        updated_at=convo.get("updated_at"),
    )


@router.post("/conversations/{convo_id}/message")
def add_message(convo_id: str, body: dict, user: dict = Depends(get_current_user)):
    """
    Append a message to a conversation.
    Body: {"role": "user"|"assistant", "content": "..."}
    """
    try:
        oid = ObjectId(convo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")

    convo = db["conversations"].find_one({"_id": oid, "user_email": user["email"]})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg = {
        "role": body.get("role", "user"),
        "content": body.get("content", ""),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    now = datetime.now(timezone.utc).isoformat()
    update = {
        "$push": {"messages": msg},
        "$inc": {"message_count": 1},
        "$set": {"updated_at": now},
    }

    if convo.get("message_count", 0) == 0 and msg["role"] == "user":
        title = msg["content"][:60] + ("..." if len(msg["content"]) > 60 else "")
        update["$set"]["title"] = title

    if msg["role"] == "user":
        update["$set"]["preview"] = msg["content"][:100]

    db["conversations"].update_one({"_id": oid}, update)
    return {"message": "Message added", "timestamp": msg["timestamp"]}


@router.post("/conversations/{convo_id}/generate-title")
def generate_title(convo_id: str, user: dict = Depends(get_current_user)):
    """Use Gemini to generate a concise, unique chat title from the conversation."""
    try:
        oid = ObjectId(convo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    convo = db["conversations"].find_one({"_id": oid, "user_email": user["email"]})
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = convo.get("messages", [])
    snippet = "\n".join(
        f"{m['role']}: {m['content'][:200]}" for m in messages[:6]
    )
    if not snippet.strip():
        return {"title": convo.get("title", "New Chat")}

    try:
        from app.services.gemini import client as gemini_client
        prompt = (
            "Generate a short, unique, descriptive title (max 6 words) for this financial chat conversation. "
            "Return ONLY the title text, nothing else. No quotes.\n\n"
            f"{snippet}"
        )
        resp = gemini_client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt,
        )
        title = resp.text.strip().strip('"').strip("'")[:60]
        if not title:
            title = messages[0]["content"][:40] if messages else "New Chat"
    except Exception:
        title = messages[0]["content"][:40] if messages else "New Chat"

    db["conversations"].update_one({"_id": oid}, {"$set": {"title": title}})
    return {"title": title}


@router.delete("/conversations")
def clear_all_conversations(user: dict = Depends(get_current_user)):
    """Delete all conversations for the current user."""
    result = db["conversations"].delete_many({"user_email": user["email"]})
    return {"message": f"Deleted {result.deleted_count} conversations", "deleted_count": result.deleted_count}


@router.delete("/conversations/{convo_id}")
def delete_conversation(convo_id: str, user: dict = Depends(get_current_user)):
    """Delete a conversation."""
    try:
        oid = ObjectId(convo_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    result = db["conversations"].delete_one({"_id": oid, "user_email": user["email"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted"}
