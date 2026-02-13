"""
Agent route — unified AI endpoint: POST /api/agent/query
Requires JWT authentication.
"""

from fastapi import APIRouter, Depends

from app.models.agent import AgentQueryRequest, AgentQueryResponse
from app.agents.financial_agent import process_query
from app.auth.deps import get_current_user

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/query", response_model=AgentQueryResponse)
def agent_query(body: AgentQueryRequest, user: dict = Depends(get_current_user)):
    """
    Universal AI query endpoint (authenticated).
    Uses the logged-in user's email as user_id for personalised memory.
    """
    user_id = user["email"]
    result = process_query(query=body.query, user_id=user_id, language=body.language)
    return AgentQueryResponse(**result)
