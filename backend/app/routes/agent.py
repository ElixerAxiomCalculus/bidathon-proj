"""
Agent route — unified AI endpoint: POST /api/agent/query
"""

from fastapi import APIRouter

from app.models.agent import AgentQueryRequest, AgentQueryResponse
from app.agents.financial_agent import process_query

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/query", response_model=AgentQueryResponse)
def agent_query(body: AgentQueryRequest):
    """
    Universal AI query endpoint.

    Accepts a natural-language financial question, routes through
    intent classification → tool execution → LLM grounding → response.

    Powers: web app, mobile app, Chrome extension.
    """
    result = process_query(query=body.query, user_id=body.user_id)
    return AgentQueryResponse(**result)
