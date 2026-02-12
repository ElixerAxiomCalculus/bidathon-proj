# Bidathon'26 — Backend API Reference

> **Base URL:** `http://localhost:8000`  
> **Framework:** FastAPI · Python  
> **Run:** `cd backend && python -m uvicorn app.main:app --reload`  
> **Interactive docs:** [`http://localhost:8000/docs`](http://localhost:8000/docs) (Swagger UI)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Environment Variables](#environment-variables)
4. [API Endpoints](#api-endpoints)
   - [Health Check](#health-check)
   - [Agent Engine](#agent-engine)
   - [Stocks (yfinance)](#stocks-yfinance)
   - [Market Overview & Trends](#market-overview--trends)
   - [Calculators (SIP / EMI / Compound)](#calculators-sip--emi--compound)
   - [URL Authenticity (Gemini LLM)](#url-authenticity-gemini-llm)
   - [Web Scraper + MongoDB](#web-scraper--mongodb)
5. [Data Models](#data-models)
6. [Services & Tools](#services--tools)
7. [Quick Start](#quick-start)

---

## Architecture Overview

```
Client (React / Postman / curl / Chrome Extension)
  │
  ▼
FastAPI  (main.py)  ─────────────────────────────────────────
  │
  ├── /api/agent/*       →  AI Agent Engine
  │     │
  │     ├─ Rate Limiter (20 req / 60 s per user)
  │     ├─ Safety Guard (risky-query detection)
  │     ├─ Intent Classifier (8 intents + ticker extraction)
  │     ├─ Tool Execution (yfinance / calculators / market / scraper)
  │     ├─ Memory Context (MongoDB session history)
  │     └─ Gemini LLM Grounding → Response + Disclaimer
  │
  ├── /api/stocks/*      →  yfinance service (quotes, history, info, search)
  ├── /api/market/*      →  Market overview + trend analysis
  ├── /api/calc/*        →  Deterministic calculators (SIP, EMI, compound)
  ├── /api/urls/*        →  Gemini LLM URL authenticity + CSV store
  └── /api/scraper/*     →  Web scraper + MongoDB persistence
```

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                        ← FastAPI entry-point, 6 routers
│   ├── agents/
│   │   ├── financial_agent.py         ← Core brain: intent→tools→LLM pipeline
│   │   ├── intent_classifier.py       ← Keyword routing (8 intents) + ticker extraction
│   │   ├── memory.py                  ← MongoDB session memory (per user, last 20)
│   │   └── safety.py                  ← Risky-query detection, disclaimers, rate limiter
│   ├── models/
│   │   ├── agent.py                   ← Agent, calculator, market, trend schemas
│   │   ├── stock.py                   ← Stock quote / history / info / search schemas
│   │   ├── url.py                     ← URL authenticity schemas
│   │   └── scraper.py                 ← Scraper + MongoDB schemas
│   ├── routes/
│   │   ├── agent.py                   ← POST /api/agent/query
│   │   ├── stock.py                   ← GET  /api/stocks/*
│   │   ├── market.py                  ← GET  /api/market/*
│   │   ├── calc.py                    ← POST /api/calc/*
│   │   ├── url.py                     ← POST/GET/DELETE /api/urls/*
│   │   └── scraper.py                 ← POST/GET/DELETE /api/scraper/*
│   ├── services/
│   │   ├── gemini.py                  ← Google Gemini 2.5 Flash client
│   │   ├── yfinance/
│   │   │   ├── yf.py                  ← Wrapper: quote, history, info, search
│   │   │   ├── trend.py               ← SMA crossover + volatility analysis
│   │   │   └── market.py              ← 8 major indices / assets overview
│   │   └── calculators/
│   │       ├── sip.py                 ← SIP return calculator
│   │       ├── emi.py                 ← EMI loan calculator
│   │       └── compound.py            ← Compound interest calculator
│   ├── tools/
│   │   ├── db.py                      ← MongoDB Atlas client (pymongo)
│   │   ├── scraper.py                 ← BeautifulSoup web scraper
│   │   ├── url_store.py               ← CSV read/write for urls.csv
│   │   └── urls.csv                   ← Authentic-URL whitelist
│   └── utils/                         ← (reserved)
├── .env                               ← GEMINI_API_KEY
└── package.json
```

---

## Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | `backend/.env` | Google Gemini 2.5 Flash API key |
| `MONGO_URI` | `backend/app/tools/.env` | MongoDB Atlas connection string |

---

## API Endpoints

### Endpoint Summary

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | `GET` | `/` | Health check |
| 2 | `POST` | `/api/agent/query` | AI agent — unified natural-language endpoint |
| 3 | `GET` | `/api/stocks/search?q=` | Search stock tickers |
| 4 | `GET` | `/api/stocks/{ticker}/quote` | Latest quote |
| 5 | `GET` | `/api/stocks/{ticker}/history` | OHLCV history |
| 6 | `GET` | `/api/stocks/{ticker}/info` | Company info |
| 7 | `GET` | `/api/market/overview` | Major indices & assets |
| 8 | `GET` | `/api/market/trend/{ticker}` | Trend analysis |
| 9 | `POST` | `/api/calc/sip` | SIP calculator |
| 10 | `POST` | `/api/calc/emi` | EMI calculator |
| 11 | `POST` | `/api/calc/compound` | Compound interest calculator |
| 12 | `POST` | `/api/urls/check` | URL authenticity check (Gemini) |
| 13 | `GET` | `/api/urls/` | List all stored URLs |
| 14 | `DELETE` | `/api/urls/?url=` | Remove a URL |
| 15 | `POST` | `/api/scraper/scrape` | Scrape URLs → MongoDB |
| 16 | `POST` | `/api/scraper/scrape-csv` | Scrape from urls.csv → MongoDB |
| 17 | `GET` | `/api/scraper/data` | All scraped documents |
| 18 | `GET` | `/api/scraper/data/search?q=` | Search scraped data |
| 19 | `GET` | `/api/scraper/data/{url}` | Single document by URL |
| 20 | `DELETE` | `/api/scraper/data/{url}` | Delete document by URL |
| 21 | `GET` | `/api/scraper/stats` | MongoDB collection stats |

---

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Returns `{"status": "ok"}` — confirms server is running |

---

### Agent Engine

**Prefix:** `/api/agent`

The unified AI endpoint. Accepts any natural-language financial question and routes it through the full pipeline: rate limiting → safety check → intent classification → tool execution → memory context → Gemini LLM grounding → response with disclaimer.

**8 intents recognised:**
`stock_quote` · `stock_analysis` · `financial_education` · `loan_query` · `market_status` · `news_query` · `calculator` · `general_finance`

#### `POST /api/agent/query`

**Request Body:**

```json
{
  "query": "Should I buy AAPL?",
  "user_id": "user_123"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | — | Natural-language financial question |
| `user_id` | string | No | `"anonymous"` | User ID for session memory and rate limiting |

**Response:** `AgentQueryResponse`

```json
{
  "response": "Based on AAPL's current data:\n- Price: $198.52 ...\n\n⚠️ Disclaimer: ...",
  "intent": "stock_analysis",
  "tools_used": ["stock_quote", "stock_history", "trend_analysis"],
  "tickers": ["AAPL"]
}
```

**Pipeline details:**

| Step | Component | Description |
|------|-----------|-------------|
| 1 | Rate Limiter | 20 requests / 60 seconds per `user_id` |
| 2 | Safety Guard | Detects risky queries (guaranteed returns, get rich quick, etc.) and returns a safe redirect |
| 3 | Intent Classifier | Keyword-based routing into 8 intents + ticker extraction |
| 4 | Tool Execution | Calls yfinance, calculators, market, scraper based on intent and tickers |
| 5 | Memory | Loads last 20 interactions from MongoDB for context |
| 6 | LLM Grounding | Sends structured data + conversation context to Gemini 2.5 Flash |
| 7 | Disclaimer | Appends financial disclaimer to stock/finance responses |

---

### Stocks (yfinance)

**Prefix:** `/api/stocks`

#### `GET /api/stocks/search?q={query}`

Search for stock tickers by company name or keyword.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | query | Yes | Company name or partial ticker (e.g. `"apple"`) |

**Response:** `SearchResult[]`

```json
[
  {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "exchange": "NASDAQ",
    "type": "EQUITY"
  }
]
```

---

#### `GET /api/stocks/{ticker}/quote`

Get the latest market quote for a ticker.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | path | Yes | Stock ticker symbol (e.g. `AAPL`, `TSLA`, `BTC-USD`) |

**Response:** `StockQuote`

```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "price": 198.52,
  "previous_close": 197.10,
  "open": 197.50,
  "day_high": 199.80,
  "day_low": 196.90,
  "volume": 51397410,
  "market_cap": 3049278599168,
  "pe_ratio": 34.83,
  "dividend_yield": 0.49,
  "52_week_high": 237.49,
  "52_week_low": 164.08,
  "currency": "USD",
  "exchange": "NMS"
}
```

---

#### `GET /api/stocks/{ticker}/history`

Get historical OHLCV price data.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `ticker` | path | Yes | — | Stock ticker symbol |
| `period` | query | No | `1mo` | `1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max` |
| `interval` | query | No | `1d` | `1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo` |

**Response:** `HistoryRecord[]`

```json
[
  {
    "date": "2025-06-10 00:00:00-04:00",
    "open": 197.50,
    "high": 199.80,
    "low": 196.90,
    "close": 198.52,
    "volume": 51397410
  }
]
```

---

#### `GET /api/stocks/{ticker}/info`

Get detailed company information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | path | Yes | Stock ticker symbol |

**Response:** `CompanyInfo`

```json
{
  "ticker": "MSFT",
  "name": "Microsoft Corporation",
  "sector": "Technology",
  "industry": "Software - Infrastructure",
  "country": "United States",
  "website": "https://www.microsoft.com",
  "description": "Microsoft Corporation develops and supports...",
  "employees": 228000,
  "market_cap": 3005430628352,
  "enterprise_value": 3036517498880
}
```

---

### Market Overview & Trends

**Prefix:** `/api/market`

#### `GET /api/market/overview`

Get live prices for 8 major market indices and assets.

**Tracked assets:** S&P 500 (`^GSPC`), NASDAQ (`^IXIC`), Dow Jones (`^DJI`), NIFTY 50 (`^NSEI`), SENSEX (`^BSESN`), Bitcoin (`BTC-USD`), Gold (`GC=F`), Crude Oil (`CL=F`)

**Response:** `MarketItem[]`

```json
[
  {
    "name": "S&P 500",
    "ticker": "^GSPC",
    "price": 5321.41,
    "previous_close": 5298.76,
    "change": 22.65,
    "change_pct": 0.43,
    "currency": "USD"
  },
  {
    "name": "Bitcoin",
    "ticker": "BTC-USD",
    "price": 104523.00,
    "previous_close": 103108.00,
    "change": 1415.00,
    "change_pct": 1.37,
    "currency": "USD"
  }
]
```

---

#### `GET /api/market/trend/{ticker}`

Get trend analysis (direction, volatility, support/resistance) for any ticker.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `ticker` | path | Yes | — | Any valid ticker symbol |
| `period` | query | No | `1mo` | `1d, 5d, 1mo, 3mo, 6mo, 1y` |
| `interval` | query | No | `1d` | `1d, 1wk, 1mo` |

**Response:** `TrendResponse`

```json
{
  "direction": "UPTREND",
  "volatility_score": 0.34,
  "price_change_pct": 5.12,
  "avg_volume": 48523100,
  "support": 189.20,
  "resistance": 199.80,
  "summary": "AAPL is in an UPTREND (SMA-10 > SMA-30). Price changed +5.12% over the period. Volatility is moderate (0.34). Support near $189.20, resistance near $199.80."
}
```

**Analysis methodology:**
- **Direction:** SMA-10 vs SMA-30 crossover → `UPTREND`, `DOWNTREND`, or `SIDEWAYS`
- **Volatility score:** Normalized standard deviation of daily returns (0 → calm, 1 → extreme)
- **Support / Resistance:** Period low and high
- **Summary:** Human-readable narrative generated from computed metrics

---

### Calculators (SIP / EMI / Compound)

**Prefix:** `/api/calc`

All calculator endpoints are deterministic — no API keys or external calls required.

#### `POST /api/calc/sip`

Calculate SIP (Systematic Investment Plan) returns.

**Request Body:**

```json
{
  "monthly_investment": 5000,
  "annual_return_rate": 12,
  "years": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `monthly_investment` | float | Yes | Amount invested every month |
| `annual_return_rate` | float | Yes | Expected annual return (e.g. `12` for 12%) |
| `years` | int | Yes | Investment duration in years |

**Response:** `SipResponse`

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

#### `POST /api/calc/emi`

Calculate EMI (Equated Monthly Installment) for a loan.

**Request Body:**

```json
{
  "principal": 1000000,
  "annual_interest_rate": 8.5,
  "tenure_months": 240
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `principal` | float | Yes | Loan amount |
| `annual_interest_rate` | float | Yes | Annual interest rate (e.g. `8.5` for 8.5%) |
| `tenure_months` | int | Yes | Loan tenure in months |

**Response:** `EmiResponse`

```json
{
  "principal": 1000000,
  "annual_interest_rate": 8.5,
  "tenure_months": 240,
  "emi": 8678.23,
  "total_payment": 2082775.20,
  "total_interest": 1082775.20
}
```

---

#### `POST /api/calc/compound`

Calculate compound interest.

**Request Body:**

```json
{
  "principal": 100000,
  "annual_rate": 7,
  "years": 5,
  "compounding_frequency": 12
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `principal` | float | Yes | — | Initial amount |
| `annual_rate` | float | Yes | — | Annual interest rate (e.g. `7` for 7%) |
| `years` | int | Yes | — | Duration in years |
| `compounding_frequency` | int | No | `12` | Times compounded per year (12 = monthly) |

**Response:** `CompoundResponse`

```json
{
  "principal": 100000,
  "annual_rate": 7,
  "years": 5,
  "compounding_frequency": 12,
  "final_amount": 141478.44,
  "interest_earned": 41478.44,
  "effective_annual_rate": 7.23
}
```

---

### URL Authenticity (Gemini LLM)

**Prefix:** `/api/urls`

#### `POST /api/urls/check`

Submit URLs for Gemini LLM authenticity assessment. Authentic URLs are saved to `urls.csv`.

**Request Body:**

```json
{
  "urls": ["https://reuters.com", "https://fake-finance-scam.xyz"]
}
```

**Response:** `UrlCheckResponse`

```json
{
  "results": [
    {
      "url": "https://reuters.com",
      "is_authentic": true,
      "confidence": 1.0,
      "category": "news",
      "reason": "Reuters is a globally recognized, highly reputable news agency."
    },
    {
      "url": "https://fake-finance-scam.xyz",
      "is_authentic": false,
      "confidence": 1.0,
      "category": "unknown",
      "reason": "The domain name contains 'fake' and 'scam'."
    }
  ],
  "saved": [],
  "skipped_duplicates": ["https://reuters.com"]
}
```

- `saved` — URLs newly added to `urls.csv`
- `skipped_duplicates` — URLs already present in `urls.csv`

---

#### `GET /api/urls/`

List all URLs stored in `urls.csv`.

**Response:** `UrlListResponse`

```json
{
  "urls": ["https://bloomberg.com", "https://reuters.com", "..."],
  "count": 130
}
```

---

#### `DELETE /api/urls/?url={url}`

Remove a URL from `urls.csv`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | query | Yes | The URL to remove |

**Response:** `{"detail": "URL '...' removed"}`

---

### Web Scraper + MongoDB

**Prefix:** `/api/scraper`

#### `POST /api/scraper/scrape`

Scrape a list of URLs and save results (title + full text) to MongoDB.

**Request Body:**

```json
{
  "urls": ["https://investopedia.com", "https://reuters.com"]
}
```

**Response:** `ScrapeResponse`

```json
{
  "total": 2,
  "succeeded": 1,
  "failed": 1,
  "results": [
    {
      "url": "https://investopedia.com",
      "title": "Investopedia",
      "success": true,
      "saved": true,
      "error": null
    },
    {
      "url": "https://reuters.com",
      "title": null,
      "success": false,
      "saved": false,
      "error": "Scraping failed (request error or empty response)"
    }
  ]
}
```

---

#### `POST /api/scraper/scrape-csv?limit={n}`

Scrape the first `n` URLs from `urls.csv` and save to MongoDB.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | query | No | `5` | Max number of URLs to scrape from the CSV |

**Response:** Same as `POST /scrape`

---

#### `GET /api/scraper/data`

Fetch all scraped documents from MongoDB.

**Response:** `ScrapedDocument[]`

```json
[
  {
    "url": "https://investopedia.com",
    "title": "Investopedia",
    "text": "Investopedia\nMajor Stock Indexes Close..."
  }
]
```

---

#### `GET /api/scraper/data/search?q={term}&limit={n}`

Search scraped documents by title or URL keyword.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | query | Yes | — | Search term (regex, case-insensitive) |
| `limit` | query | No | `20` | Max results |

**Response:** `ScrapedDocument[]`

---

#### `GET /api/scraper/data/{url}`

Fetch a single scraped document by its full URL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | path | Yes | Full URL (e.g. `https://investopedia.com`) |

**Response:** `ScrapedDocument`

---

#### `DELETE /api/scraper/data/{url}`

Delete a scraped document from MongoDB by URL.

**Response:** `{"detail": "Scraped data for '...' deleted"}`

---

#### `GET /api/scraper/stats`

Get MongoDB collection statistics.

**Response:** `DbStatsResponse`

```json
{
  "collection": "scraped_data",
  "document_count": 93
}
```

---

## Data Models

### Agent Models (`app/models/agent.py`)

| Model | Fields |
|-------|--------|
| `AgentQueryRequest` | query, user_id (`"anonymous"`) |
| `AgentQueryResponse` | response, intent, tools_used, tickers |
| `SipRequest` | monthly_investment, annual_return_rate, years |
| `SipResponse` | monthly_investment, annual_return_rate, years, total_months, total_invested, estimated_returns, total_value |
| `EmiRequest` | principal, annual_interest_rate, tenure_months |
| `EmiResponse` | principal, annual_interest_rate, tenure_months, emi, total_payment, total_interest |
| `CompoundRequest` | principal, annual_rate, years, compounding_frequency (`12`) |
| `CompoundResponse` | principal, annual_rate, years, compounding_frequency, final_amount, interest_earned, effective_annual_rate |
| `MarketItem` | name, ticker, price, previous_close, change, change_pct, currency |
| `TrendResponse` | direction, volatility_score, price_change_pct, avg_volume, support, resistance, summary |

### Stock Models (`app/models/stock.py`)

| Model | Fields |
|-------|--------|
| `StockQuote` | ticker, name, price, previous_close, open, day_high, day_low, volume, market_cap, pe_ratio, dividend_yield, 52_week_high, 52_week_low, currency, exchange |
| `HistoryRecord` | date, open, high, low, close, volume |
| `CompanyInfo` | ticker, name, sector, industry, country, website, description, employees, market_cap, enterprise_value |
| `SearchResult` | symbol, name, exchange, type |

### URL Models (`app/models/url.py`)

| Model | Fields |
|-------|--------|
| `UrlSubmission` | urls (list of strings) |
| `AuthenticityResult` | url, is_authentic, confidence, category, reason |
| `UrlCheckResponse` | results, saved, skipped_duplicates |
| `UrlListResponse` | urls, count |

### Scraper Models (`app/models/scraper.py`)

| Model | Fields |
|-------|--------|
| `ScrapeRequest` | urls (list of strings) |
| `ScrapedDocument` | url, title, text |
| `ScrapeResultItem` | url, title, success, saved, error |
| `ScrapeResponse` | total, succeeded, failed, results |
| `DbStatsResponse` | collection, document_count |

---

## Services & Tools

### Services (External Integrations)

| Service | File | Description |
|---------|------|-------------|
| **Gemini LLM** | `app/services/gemini.py` | Google Gemini 2.5 Flash. URL authenticity assessment + agent response grounding. |
| **yfinance** | `app/services/yfinance/yf.py` | Stock data: `get_stock_quote()`, `get_stock_history()`, `get_company_info()`, `search_ticker()` |
| **Trend Analyzer** | `app/services/yfinance/trend.py` | SMA crossover for direction, normalised stdev for volatility, support/resistance from period extremes. |
| **Market Overview** | `app/services/yfinance/market.py` | Fetches live prices for 8 indices/assets: S&P 500, NASDAQ, Dow, NIFTY, SENSEX, BTC, Gold, Oil. |
| **SIP Calculator** | `app/services/calculators/sip.py` | Deterministic SIP returns using compound interest formula. |
| **EMI Calculator** | `app/services/calculators/emi.py` | Deterministic EMI via standard amortisation formula. |
| **Compound Interest** | `app/services/calculators/compound.py` | Compound interest with configurable compounding frequency. |

### Agent Components

| Component | File | Description |
|-----------|------|-------------|
| **Financial Agent** | `app/agents/financial_agent.py` | Core brain. Orchestrates the full pipeline: intent → tools → memory → LLM → disclaimer. |
| **Intent Classifier** | `app/agents/intent_classifier.py` | Keyword-based routing into 8 intents. Extracts valid tickers while filtering common English words. |
| **Memory** | `app/agents/memory.py` | MongoDB `user_sessions` collection. Stores last 20 interactions per `user_id`. Provides context summaries for LLM. |
| **Safety** | `app/agents/safety.py` | Regex patterns detect risky queries (guaranteed returns, insider trading, etc.). In-memory rate limiter (20 req/60 s). Appends disclaimer to financial responses. |

### Tools (Utilities & Data Access)

| Tool | File | Description |
|------|------|-------------|
| **Web Scraper** | `app/tools/scraper.py` | `requests` + `BeautifulSoup`. Strips scripts, styles, nav, footer. Returns title + cleaned text. |
| **MongoDB** | `app/tools/db.py` | PyMongo client → `bidathon_db.scraped_data`. CRUD functions: save, get all, get by URL, search, delete, stats. |
| **URL Store** | `app/tools/url_store.py` | CSV helper for `urls.csv`: `read_urls()`, `append_urls()` (deduplicates), `remove_url()`. |

---

## Quick Start

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
pip install fastapi uvicorn yfinance beautifulsoup4 requests pymongo python-dotenv google-genai pydantic

# 3. Set up environment variables
#    backend/.env            → GEMINI_API_KEY="your-key"
#    backend/app/tools/.env  → MONGO_URI="your-mongodb-uri"

# 4. Start server
python -m uvicorn app.main:app --reload

# 5. Open interactive docs
#    http://localhost:8000/docs
```
