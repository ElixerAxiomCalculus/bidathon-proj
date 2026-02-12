from fastapi import APIRouter, HTTPException, Query

from app.models.scraper import (
    ScrapeRequest,
    ScrapedDocument,
    ScrapeResultItem,
    ScrapeResponse,
    DbStatsResponse,
)
from app.tools.scraper import scrape_website
from app.tools.db import (
    save_to_db,
    get_all_scraped,
    get_scraped_by_url,
    search_scraped,
    delete_scraped_by_url,
    get_db_stats,
)
from app.tools.url_store import read_urls

router = APIRouter(prefix="/scraper", tags=["scraper"])


@router.post("/scrape", response_model=ScrapeResponse)
def scrape_urls(body: ScrapeRequest):
    """Scrape a list of URLs and save the results to MongoDB."""
    results: list[ScrapeResultItem] = []
    succeeded = 0
    failed = 0

    for url in body.urls:
        scraped = scrape_website(url)
        if scraped:
            try:
                save_to_db(scraped)
                results.append(
                    ScrapeResultItem(
                        url=url,
                        title=scraped["title"],
                        success=True,
                        saved=True,
                    )
                )
                succeeded += 1
            except Exception as e:
                results.append(
                    ScrapeResultItem(
                        url=url,
                        title=scraped["title"],
                        success=True,
                        saved=False,
                        error=f"DB save failed: {e}",
                    )
                )
                failed += 1
        else:
            results.append(
                ScrapeResultItem(
                    url=url,
                    success=False,
                    saved=False,
                    error="Scraping failed (request error or empty response)",
                )
            )
            failed += 1

    return ScrapeResponse(
        total=len(body.urls),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )


@router.post("/scrape-csv", response_model=ScrapeResponse)
def scrape_from_csv(limit: int = Query(5, description="Max URLs to scrape from CSV")):
    """Scrape URLs from tools/urls.csv and save results to MongoDB."""
    all_urls = read_urls()
    urls_to_scrape = all_urls[:limit]
    return scrape_urls(ScrapeRequest(urls=urls_to_scrape))


@router.get("/data", response_model=list[ScrapedDocument])
def list_scraped_data():
    """Fetch all scraped data from MongoDB."""
    docs = get_all_scraped()
    return docs


@router.get("/data/search", response_model=list[ScrapedDocument])
def search_data(
    q: str = Query(..., description="Search term for title or URL"),
    limit: int = Query(20, description="Max results"),
):
    """Search scraped data by title or URL keyword."""
    return search_scraped(q, limit=limit)


@router.get("/data/{url:path}", response_model=ScrapedDocument)
def get_scraped_document(url: str):
    """Fetch a single scraped document by its URL."""
    doc = get_scraped_by_url(url)
    if not doc:
        raise HTTPException(status_code=404, detail=f"No scraped data for '{url}'")
    return doc


@router.delete("/data/{url:path}")
def delete_scraped_document(url: str):
    """Delete a scraped document by URL."""
    removed = delete_scraped_by_url(url)
    if not removed:
        raise HTTPException(status_code=404, detail=f"No scraped data for '{url}'")
    return {"detail": f"Scraped data for '{url}' deleted"}


@router.get("/stats", response_model=DbStatsResponse)
def stats():
    """Get stats about the scraped_data collection in MongoDB."""
    return get_db_stats()
