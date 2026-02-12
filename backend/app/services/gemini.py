import os

from dotenv import load_dotenv
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

client = genai.Client(api_key=GEMINI_API_KEY)

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


def check_url_authenticity(url: str) -> dict:
    """Ask Gemini to assess whether a URL is a trustworthy financial source."""
    prompt = AUTHENTICITY_PROMPT.format(url=url)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    import json

    text = response.text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


def check_urls_authenticity(urls: list[str]) -> list[dict]:
    """Check multiple URLs for authenticity."""
    return [check_url_authenticity(url) for url in urls]
