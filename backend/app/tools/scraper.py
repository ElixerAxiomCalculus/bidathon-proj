from bs4 import BeautifulSoup
import requests
import csv
import time
import random

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


def scrape_website(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        title = soup.title.string.strip() if soup.title and soup.title.string else 'No title found'

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)

        return {
            'url': url,
            'title': title,
            'text': text
        }
    except requests.exceptions.RequestException as e:
        print(f"An error occurred for {url}: {e}")
        return None


def scrape_websites_from_csv(csv_file):
    results = []
    with open(csv_file, mode='r') as file:
        reader = csv.DictReader(file)  
        for row in reader:
            url = row['url'].strip()
            if not url:
                continue
            print(f"Scraping {url} ...")
            result = scrape_website(url)
            if result:
                results.append(result)
            time.sleep(random.uniform(1, 3))
    return results


if __name__ == "__main__":
    csv_file = 'urls.csv'
    scraped_data = scrape_websites_from_csv(csv_file)

    from db import save_to_db  

    for data in scraped_data:
        save_to_db(data)
        print(f"Title: {data['title']}")
        print(f"Text: {data['text'][:50]}...")
        print("\n")
