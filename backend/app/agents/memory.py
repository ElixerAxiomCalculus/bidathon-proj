"""
Memory Layer — MongoDB-backed session memory per user.

Stores recent interactions so the agent can reference prior context.
Collection: user_sessions in bidathon_db.
"""

from app.tools.db import db


def save_interaction(
    user_id: str,
    query: str,
    intent: str,
    response_summary: str,
    tickers: list[str] | None = None,
) -> None:
    """Save an interaction to the user's session history (last 20 kept)."""
    interaction = {
        "query": query,
        "intent": intent,
        "response_summary": response_summary,
    }
    if tickers:
        interaction["tickers"] = tickers
    db["user_sessions"].update_one(
        {"user_id": user_id},
        {
            "$push": {
                "interactions": {
                    "$each": [interaction],
                    "$slice": -20,
                }
            },
            "$set": {"user_id": user_id},
        },
        upsert=True,
    )


def get_context_summary(user_id: str, last_n: int = 3) -> str | None:
    """
    Build a plain-text context summary from the last N interactions.

    Returns None if no history exists.
    """
    session = db["user_sessions"].find_one(
        {"user_id": user_id}, {"_id": 0, "interactions": {"$slice": -last_n}}
    )
    if not session or not session.get("interactions"):
        return None

    lines = []
    for i, item in enumerate(session["interactions"], 1):
        lines.append(
            f"[{i}] User asked ({item.get('intent', '?')}): {item.get('query', '')}\n"
            f"    Summary: {item.get('response_summary', '')}"
        )
    return "\n".join(lines)


def get_session(user_id: str) -> dict | None:
    """Get the full session document for a user."""
    return db["user_sessions"].find_one({"user_id": user_id}, {"_id": 0})


def clear_session(user_id: str) -> bool:
    """Delete a user's session. Returns True if deleted."""
    result = db["user_sessions"].delete_one({"user_id": user_id})
    return result.deleted_count > 0


def get_last_tickers(user_id: str) -> list[str]:
    """Get the most recently used tickers from the user's conversation history."""
    session = db["user_sessions"].find_one(
        {"user_id": user_id}, {"_id": 0, "interactions": {"$slice": -5}}
    )
    if not session or not session.get("interactions"):
        return []
    # Walk backwards to find the most recent interaction that had tickers
    for item in reversed(session["interactions"]):
        tickers = item.get("tickers", [])
        if tickers:
            return tickers
    return []
