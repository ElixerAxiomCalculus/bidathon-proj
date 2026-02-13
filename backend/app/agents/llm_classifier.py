
"""
LLM-Based Intent Classification.

Uses an LLM (OpenAI with Gemini fallback) to infer user intent and extract entities,
providing a reasoning layer that is more robust than keyword matching.
"""

import json
import re
from typing import TypedDict, List

from app.services.openai_llm import chat_completion
from app.agents.intent_classifier import Intent, classify as keyword_classify


class ClassificationResult(TypedDict):
    intent: Intent
    tickers: List[str]
    reasoning: str


_SYSTEM_PROMPT = """You are a financial intent understanding engine.
Your job is to analyze the user's query and extracting two things:
1. The **Intent** (what they want to do).
2. The **Entities** (stock tickers, if any).

### Supported Intents:
- `stock_quote`: Asking for current price, "how much is...", generic lookup.
- `stock_analysis`: Asking for advice, "should I buy", "outlook", "forecast", "trends", "prediction".
- `financial_education`: Asking "what is...", "explain...", "how does... work".
- `market_status`: Asking about general market, Nifty, Sensex, "how is the market".
- `news_query`: Asking for news, headlines, recent events.
- `calculator`: Asking to calculate SIP, EMI, returns, interest.
- `trade_order`: Explicitly wanting to buy/sell/trade, or view portfolio/holdings.
- `stock_chart`: Asking for a chart, graph, visual, or trend line.
- `loan_query`: Asking about loans, mortgages, interest rates.
- `general_finance`: Greetings, or queries that don't fit above.

### Entity Extraction Rules:
- Extract stock symbols (e.g., "TCS", "Reliance", "HDFC Bank", "^BSESN" for Sensex, "^NSEI" for Nifty).
- Map common names to tickers where possible (e.g. "Sensex" -> "^BSESN", "Nifty" -> "^NSEI").
- IGNORE common words that look like tickers (e.g., "TRENDS", "SHOWING", "PRICES", "NEXT", "BEST").

### Output Format:
Respond ONLY with a valid JSON object:
{
  "intent": "<one_of_the_intents_above>",
  "tickers": ["<TICKER_1>", "<TICKER_2>"],
  "reasoning": "<brief explanation of why you chose this intent>"
}
"""

def _clean_json_response(text: str) -> dict:
    """Extract JSON from potential markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def classify_query(query: str) -> ClassificationResult:
    """
    Classify a user query using an LLM. 
    Falls back to keyword matching if LLM fails.
    """
    try:
        response_text = chat_completion(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=f"User Query: {query}"
        )
        data = _clean_json_response(response_text)
        
        # Validate intent
        intent_str = data.get("intent", "").lower()
        if intent_str not in [i.value for i in Intent]:
            # Try to fuzzily match or default
            intent_str = Intent.GENERAL_FINANCE
            
        return {
            "intent": intent_str,
            "tickers": data.get("tickers", []),
            "reasoning": data.get("reasoning", "LLM processing")
        }

    except Exception as e:
        print(f"[LLM Classifier Error] {e} - Falling back to keywords.")
        # Fallback to the strict keyword classifier
        kw_result = keyword_classify(query)
        return {
            "intent": kw_result["intent"],
            "tickers": kw_result["tickers"],
            "reasoning": "Fallback to keyword matching due to LLM error."
        }
