import csv
import os
from pathlib import Path

CSV_PATH = Path(__file__).parent / "urls.csv"


def read_urls() -> list[str]:
    """Read all URLs currently stored in urls.csv."""
    if not CSV_PATH.exists():
        return []
    with open(CSV_PATH, mode="r", newline="") as f:
        reader = csv.DictReader(f)
        return [row["url"].strip() for row in reader if row["url"].strip()]


def append_urls(urls: list[str]) -> list[str]:
    """
    Append new URLs to urls.csv (skips duplicates).
    Returns the list of URLs that were actually added.
    """
    existing = set(read_urls())
    new_urls = [u for u in urls if u not in existing]
    if not new_urls:
        return []

    file_exists = CSV_PATH.exists() and CSV_PATH.stat().st_size > 0
    with open(CSV_PATH, mode="a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["url"])
        for url in new_urls:
            writer.writerow([url])
    return new_urls


def remove_url(url: str) -> bool:
    """Remove a URL from urls.csv. Returns True if found & removed."""
    urls = read_urls()
    if url not in urls:
        return False
    urls.remove(url)
    with open(CSV_PATH, mode="w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["url"])
        for u in urls:
            writer.writerow([u])
    return True
