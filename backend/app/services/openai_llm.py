"""
LLM service — OpenAI primary, Gemini fallback.

Uses gpt-4o-mini as the primary model. Falls back to Gemini 2.5 Flash
when OpenAI is unavailable (quota exceeded, rate-limited, etc.).
"""

import json
import os

from dotenv import load_dotenv
from openai import OpenAI
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in .env file")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

OPENAI_MODEL = "gpt-4o-mini"
GEMINI_MODEL = "gemini-2.5-flash"


def chat_completion(system_prompt: str, user_prompt: str) -> str:
    """
    General-purpose chat completion with automatic fallback.

    Tries OpenAI first; if it fails (quota, rate-limit, network), falls back
    to Gemini so the user always gets a response.
    """
    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=2048,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        combined_prompt = f"{system_prompt}\n\n{user_prompt}"
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=combined_prompt,
        )
        return response.text.strip()


AUTHENTICITY_PROMPT = """You are a financial news source authenticity analyst.
Given the following URL, evaluate whether it is a **legitimate and trustworthy**
source for financial / stock-market information.

URL: {url}

Respond ONLY with valid JSON (no markdown fences) in this exact format:
{{
  "url": "<the url>",
  "is_authentic": true | false,
  "confidence": <float 0-1>,
  "category": "<e.g. news, exchange, analytics, social, unknown>",
  "reason": "<one-line explanation>"
}}
"""


def _parse_json_response(text: str) -> dict:
    """Strip markdown fences and parse JSON."""
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def check_url_authenticity(url: str) -> dict:
    """Assess whether a URL is a trustworthy financial source (OpenAI → Gemini fallback)."""
    prompt = AUTHENTICITY_PROMPT.format(url=url)
    try:
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=300,
        )
        text = response.choices[0].message.content.strip()
    except Exception:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        text = response.text.strip()
    return _parse_json_response(text)


def check_urls_authenticity(urls: list[str]) -> list[dict]:
    """Check multiple URLs for authenticity."""
    return [check_url_authenticity(url) for url in urls]
