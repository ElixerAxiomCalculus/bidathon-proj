from fastapi import APIRouter, HTTPException

from app.models.url import (
    UrlSubmission,
    AuthenticityResult,
    UrlCheckResponse,
    UrlListResponse,
)
from app.services.gemini import check_url_authenticity
from app.tools.url_store import read_urls, append_urls, remove_url

router = APIRouter(prefix="/urls", tags=["urls"])


@router.post("/check", response_model=UrlCheckResponse)
def check_and_save_urls(body: UrlSubmission):
    """
    Accept a list of URLs, run each through Gemini for an authenticity check,
    save authentic ones to tools/urls.csv, and return the full results.
    """
    results: list[AuthenticityResult] = []
    authentic_urls: list[str] = []

    for url in body.urls:
        try:
            raw = check_url_authenticity(url)
            result = AuthenticityResult(**raw)
            results.append(result)
            if result.is_authentic:
                authentic_urls.append(url)
        except Exception as e:
            results.append(
                AuthenticityResult(
                    url=url,
                    is_authentic=False,
                    confidence=0.0,
                    category="error",
                    reason=f"LLM check failed: {e}",
                )
            )

    saved = append_urls(authentic_urls)
    skipped = [u for u in authentic_urls if u not in saved]

    return UrlCheckResponse(results=results, saved=saved, skipped_duplicates=skipped)


@router.get("/", response_model=UrlListResponse)
def list_urls():
    """List all URLs currently stored in urls.csv."""
    urls = read_urls()
    return UrlListResponse(urls=urls, count=len(urls))


@router.delete("/")
def delete_url(url: str):
    """Remove a URL from urls.csv."""
    removed = remove_url(url)
    if not removed:
        raise HTTPException(status_code=404, detail=f"URL '{url}' not found in store")
    return {"detail": f"URL '{url}' removed"}
