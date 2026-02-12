# Bidathon'26 — Testing Guide

How to test every endpoint using **Postman**, **curl**, or **PowerShell**.

> **Base URL:** `http://localhost:8000`
> Start the server first: `cd backend && python -m uvicorn app.main:app --reload`

---

## Table of Contents

1. [Health Check](#1-health-check)
2. [Agent Engine](#2-agent-engine)
3. [Stocks](#3-stocks)
4. [Market Overview & Trends](#4-market-overview--trends)
5. [Calculators](#5-calculators)
6. [URL Authenticity](#6-url-authenticity)
7. [Web Scraper + MongoDB](#7-web-scraper--mongodb)

---

## 1. Health Check

### `GET /`

**curl:**
```bash
curl http://localhost:8000/
```

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/
```

**Postman:** `GET` → `http://localhost:8000/`

**Expected:**
```json
{ "status": "ok" }
```

---

## 2. Agent Engine

### `POST /api/agent/query` — Stock Analysis

**curl:**
```bash
curl -X POST http://localhost:8000/api/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Should I buy AAPL?", "user_id": "test_user"}'
```

**PowerShell:**
```powershell
$body = @{ query = "Should I buy AAPL?"; user_id = "test_user" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/agent/query -Body $body -ContentType "application/json"
```

**Postman:**
- Method: `POST`
- URL: `http://localhost:8000/api/agent/query`
- Body → raw → JSON:
```json
{
  "query": "Should I buy AAPL?",
  "user_id": "test_user"
}
```

**Expected:** A response with `intent: "stock_analysis"`, `tools_used` containing stock-related tools, `tickers: ["AAPL"]`, and a grounded `response` with a disclaimer.

---

### More Agent Queries to Try

| Query | Expected Intent | Notes |
|-------|----------------|-------|
| `"What is the price of TSLA?"` | `stock_quote` | Returns live TSLA price |
| `"What is a mutual fund?"` | `financial_education` | LLM explains from training knowledge |
| `"Calculate SIP for 5000/month at 12% for 10 years"` | `calculator` | Runs SIP calculator tool |
| `"How is the market doing today?"` | `market_status` | Fetches market overview |
| `"What is the latest news on MSFT?"` | `news_query` | Attempts news-related data |
| `"How to get rich quick with crypto?"` | (blocked) | Safety guard intercepts this |
| `"Calculate EMI for 10 lakh loan at 8.5% for 20 years"` | `loan_query` | Runs EMI calculator |

---

## 3. Stocks

### `GET /api/stocks/search?q=apple`

**curl:**
```bash
curl "http://localhost:8000/api/stocks/search?q=apple"
```

**PowerShell:**
```powershell
Invoke-RestMethod "http://localhost:8000/api/stocks/search?q=apple"
```

**Postman:** `GET` → `http://localhost:8000/api/stocks/search?q=apple`

**Expected:** Array of matching tickers (AAPL, APLE, etc.)

---

### `GET /api/stocks/{ticker}/quote`

**curl:**
```bash
curl http://localhost:8000/api/stocks/AAPL/quote
```

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/api/stocks/AAPL/quote
```

**Postman:** `GET` → `http://localhost:8000/api/stocks/AAPL/quote`

**Expected:** Live quote with price, volume, market_cap, pe_ratio, etc.

---

### `GET /api/stocks/{ticker}/history`

**curl:**
```bash
curl "http://localhost:8000/api/stocks/AAPL/history?period=5d&interval=1d"
```

**PowerShell:**
```powershell
Invoke-RestMethod "http://localhost:8000/api/stocks/AAPL/history?period=5d&interval=1d"
```

**Postman:** `GET` → `http://localhost:8000/api/stocks/AAPL/history?period=5d&interval=1d`

**Expected:** Array of OHLCV records for the last 5 trading days.

---

### `GET /api/stocks/{ticker}/info`

**curl:**
```bash
curl http://localhost:8000/api/stocks/MSFT/info
```

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/api/stocks/MSFT/info
```

**Postman:** `GET` → `http://localhost:8000/api/stocks/MSFT/info`

**Expected:** Company details — sector, industry, description, employees, etc.

---

## 4. Market Overview & Trends

### `GET /api/market/overview`

**curl:**
```bash
curl http://localhost:8000/api/market/overview
```

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/api/market/overview
```

**Postman:** `GET` → `http://localhost:8000/api/market/overview`

**Expected:** Array of 8 items — S&P 500, NASDAQ, Dow Jones, NIFTY 50, SENSEX, BTC, Gold, Crude Oil with live prices and change %.

---

### `GET /api/market/trend/{ticker}`

**curl:**
```bash
curl "http://localhost:8000/api/market/trend/AAPL?period=1mo&interval=1d"
```

**PowerShell:**
```powershell
Invoke-RestMethod "http://localhost:8000/api/market/trend/AAPL?period=1mo&interval=1d"
```

**Postman:** `GET` → `http://localhost:8000/api/market/trend/AAPL?period=1mo&interval=1d`

**Expected:** `direction` (UPTREND/DOWNTREND/SIDEWAYS), `volatility_score`, `support`, `resistance`, `summary`.

---

## 5. Calculators

### `POST /api/calc/sip`

**curl:**
```bash
curl -X POST http://localhost:8000/api/calc/sip \
  -H "Content-Type: application/json" \
  -d '{"monthly_investment": 5000, "annual_return_rate": 12, "years": 10}'
```

**PowerShell:**
```powershell
$body = @{ monthly_investment = 5000; annual_return_rate = 12; years = 10 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/calc/sip -Body $body -ContentType "application/json"
```

**Postman:**
- Method: `POST`
- URL: `http://localhost:8000/api/calc/sip`
- Body → raw → JSON:
```json
{
  "monthly_investment": 5000,
  "annual_return_rate": 12,
  "years": 10
}
```

**Expected:**
```json
{
  "monthly_investment": 5000,
  "annual_return_rate": 12,
  "years": 10,
  "total_months": 120,
  "total_invested": 600000,
  "estimated_returns": 558071.47,
  "total_value": 1158071.47
}
```

---

### `POST /api/calc/emi`

**curl:**
```bash
curl -X POST http://localhost:8000/api/calc/emi \
  -H "Content-Type: application/json" \
  -d '{"principal": 1000000, "annual_interest_rate": 8.5, "tenure_months": 240}'
```

**PowerShell:**
```powershell
$body = @{ principal = 1000000; annual_interest_rate = 8.5; tenure_months = 240 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/calc/emi -Body $body -ContentType "application/json"
```

**Postman:**
- Method: `POST`
- URL: `http://localhost:8000/api/calc/emi`
- Body → raw → JSON:
```json
{
  "principal": 1000000,
  "annual_interest_rate": 8.5,
  "tenure_months": 240
}
```

**Expected:** `emi`, `total_payment`, `total_interest` fields.

---

### `POST /api/calc/compound`

**curl:**
```bash
curl -X POST http://localhost:8000/api/calc/compound \
  -H "Content-Type: application/json" \
  -d '{"principal": 100000, "annual_rate": 7, "years": 5, "compounding_frequency": 12}'
```

**PowerShell:**
```powershell
$body = @{ principal = 100000; annual_rate = 7; years = 5; compounding_frequency = 12 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/calc/compound -Body $body -ContentType "application/json"
```

**Postman:**
- Method: `POST`
- URL: `http://localhost:8000/api/calc/compound`
- Body → raw → JSON:
```json
{
  "principal": 100000,
  "annual_rate": 7,
  "years": 5,
  "compounding_frequency": 12
}
```

**Expected:** `final_amount`, `interest_earned`, `effective_annual_rate` fields.

---

## 6. URL Authenticity

### `POST /api/urls/check`

**curl:**
```bash
curl -X POST http://localhost:8000/api/urls/check \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://reuters.com", "https://totally-fake-scam.xyz"]}'
```

**PowerShell:**
```powershell
$body = @{ urls = @("https://reuters.com", "https://totally-fake-scam.xyz") } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/urls/check -Body $body -ContentType "application/json"
```

**Postman:**
- Method: `POST`
- URL: `http://localhost:8000/api/urls/check`
- Body → raw → JSON:
```json
{
  "urls": ["https://reuters.com", "https://totally-fake-scam.xyz"]
}
```

**Expected:** `results` array with `is_authentic`, `confidence`, `category`, `reason` per URL. `saved` and `skipped_duplicates` lists.

---

### `GET /api/urls/`

**curl:**
```bash
curl http://localhost:8000/api/urls/
```

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/api/urls/
```

**Postman:** `GET` → `http://localhost:8000/api/urls/`

**Expected:** `{ "urls": [...], "count": N }`

---

### `DELETE /api/urls/?url=https://example.com`

**curl:**
```bash
curl -X DELETE "http://localhost:8000/api/urls/?url=https://example.com"
```

**PowerShell:**
```powershell
Invoke-RestMethod -Method Delete "http://localhost:8000/api/urls/?url=https://example.com"
```

**Postman:** `DELETE` → `http://localhost:8000/api/urls/?url=https://example.com`

**Expected:** `{ "detail": "URL 'https://example.com' removed" }`

---

## 7. Web Scraper + MongoDB

### `POST /api/scraper/scrape`

**curl:**
```bash
curl -X POST http://localhost:8000/api/scraper/scrape \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://investopedia.com"]}'
```

**PowerShell:**
```powershell
$body = @{ urls = @("https://investopedia.com") } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/scraper/scrape -Body $body -ContentType "application/json"
```

**Postman:**
- Method: `POST`
- URL: `http://localhost:8000/api/scraper/scrape`
- Body → raw → JSON:
```json
{
  "urls": ["https://investopedia.com"]
}
```

**Expected:** `total`, `succeeded`, `failed`, `results` array.

> **Note:** Sites like Reuters, Bloomberg will return `success: false` because they block bot requests.

---

### `POST /api/scraper/scrape-csv?limit=3`

**curl:**
```bash
curl -X POST "http://localhost:8000/api/scraper/scrape-csv?limit=3"
```

**PowerShell:**
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/scraper/scrape-csv?limit=3"
```

**Postman:** `POST` → `http://localhost:8000/api/scraper/scrape-csv?limit=3`

**Expected:** Scrapes first 3 URLs from `urls.csv` and saves to MongoDB.

---

### `GET /api/scraper/data`

**curl:**
```bash
curl http://localhost:8000/api/scraper/data
```

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/api/scraper/data
```

**Postman:** `GET` → `http://localhost:8000/api/scraper/data`

**Expected:** Array of `{ url, title, text }` documents.

---

### `GET /api/scraper/data/search?q=invest&limit=5`

**curl:**
```bash
curl "http://localhost:8000/api/scraper/data/search?q=invest&limit=5"
```

**PowerShell:**
```powershell
Invoke-RestMethod "http://localhost:8000/api/scraper/data/search?q=invest&limit=5"
```

**Postman:** `GET` → `http://localhost:8000/api/scraper/data/search?q=invest&limit=5`

**Expected:** Filtered documents matching "invest" in title or URL.

---

### `GET /api/scraper/data/{url}`

**curl:**
```bash
curl http://localhost:8000/api/scraper/data/https://investopedia.com
```

**Postman:** `GET` → `http://localhost:8000/api/scraper/data/https://investopedia.com`

**Expected:** Single `{ url, title, text }` document.

---

### `DELETE /api/scraper/data/{url}`

**curl:**
```bash
curl -X DELETE http://localhost:8000/api/scraper/data/https://investopedia.com
```

**Postman:** `DELETE` → `http://localhost:8000/api/scraper/data/https://investopedia.com`

**Expected:** `{ "detail": "Scraped data for '...' deleted" }`

---

### `GET /api/scraper/stats`

**curl:**
```bash
curl http://localhost:8000/api/scraper/stats
```

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/api/scraper/stats
```

**Postman:** `GET` → `http://localhost:8000/api/scraper/stats`

**Expected:**
```json
{
  "collection": "scraped_data",
  "document_count": 93
}
```

---

## Postman Tips

1. **Import all endpoints at once:** Open `http://localhost:8000/openapi.json` in a browser, save the JSON, then in Postman → Import → select the file. All 21 endpoints will be auto-created.

2. **Set a base URL variable:** In Postman, create a variable `{{base}}` = `http://localhost:8000` and use `{{base}}/api/agent/query` in URLs for easy switching between environments.

3. **Test the Agent with different user IDs:** Use different `user_id` values to test session memory isolation. The agent remembers last 20 interactions per user.

4. **Rate limit testing:** Send 21 rapid requests with the same `user_id` to see the rate limiter kick in (20 req / 60 s).
