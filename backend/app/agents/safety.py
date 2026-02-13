"""
Safety & Rate Limiting — guardrails for the financial agent.

- Detects risky / irresponsible queries
- Injects financial disclaimer
- In-memory rate limiter (20 requests / 60 seconds per user)
"""

import re
import time
from collections import defaultdict


DISCLAIMER = (
    "\n\n---\n"
    "**Disclaimer:** This is AI-generated analysis for informational purposes only. "
    "It does NOT constitute financial advice. Always consult a qualified financial advisor "
    "before making investment decisions. Past performance does not guarantee future results."
)


_RISKY_PATTERNS = [
    r"guarantee[d]?\s+(return|profit|money|income)",
    r"get\s+rich\s+(quick|fast)",
    r"double\s+(my\s+)?money",
    r"100%\s+(return|profit|sure|guarantee)",
    r"insider\s+(info|tip|trading|knowledge)",
    r"pump\s+and\s+dump",
    r"sure\s+shot\s+(stock|investment|tip)",
    r"can'?t\s+lose",
    r"risk\s*-?\s*free\s+(return|investment|profit)",
    r"make\s+.*\s+overnight",
    r"secret\s+(stock|investment|strategy|formula)",
    r"no\s+risk\s+(investment|stock|return)",
]

_RISKY_RESPONSE = (
    "I understand you're looking for high returns, but I need to be responsible:\n\n"
    "• **No investment offers guaranteed returns.** Anyone claiming otherwise is likely "
    "misleading you.\n"
    "• Markets carry inherent risk — past performance never guarantees future results.\n"
    "• Be cautious of get-rich-quick schemes or 'insider tips'.\n\n"
    "**What I CAN help with:**\n"
    "- Analyzing a stock's fundamentals and trends with real data\n"
    "- Calculating SIP/EMI/compound interest returns\n"
    "- Explaining financial concepts so you can make informed decisions\n\n"
    "Would you like me to help with any of these instead?"
)


def detect_risky_query(query: str) -> str | None:
    """
    Check if a query contains risky financial patterns.

    Returns the safe response string if risky, None if safe.
    """
    lower = query.lower()
    for pattern in _RISKY_PATTERNS:
        if re.search(pattern, lower):
            return _RISKY_RESPONSE
    return None


_WINDOW_SECONDS = 60
_MAX_REQUESTS = 20

_request_log: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(user_id: str) -> bool:
    """
    Check if a user is within the rate limit.

    Returns True if the request is allowed, False if rate-limited.
    """
    now = time.time()
    window_start = now - _WINDOW_SECONDS

    _request_log[user_id] = [
        ts for ts in _request_log[user_id] if ts > window_start
    ]

    if len(_request_log[user_id]) >= _MAX_REQUESTS:
        return False

    _request_log[user_id].append(now)
    return True
