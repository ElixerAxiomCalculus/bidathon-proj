# FinAlly — Backend API Reference

> **Base URL:** `http://localhost:8000`
> **Framework:** FastAPI · Python 3.13
> **Run:** `cd backend && python -m uvicorn app.main:app --reload`
> **Interactive docs:** [`http://localhost:8000/docs`](http://localhost:8000/docs) (Swagger UI)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Environment Variables](#environment-variables)
4. [Authentication & Security](#authentication--security)
5. [API Endpoints](#api-endpoints)
   - [Health Check](#health-check)
   - [Auth — Signup / Login / OTP / Profile](#auth--signup--login--otp--profile)
   - [Agent Engine](#agent-engine)
   - [Stocks (yfinance)](#stocks-yfinance)
   - [Market Overview & Trends](#market-overview--trends)
   - [Calculators (SIP / EMI / Compound)](#calculators-sip--emi--compound)
   - [URL Authenticity (OpenAI LLM)](#url-authenticity-openai-llm)
   - [Web Scraper + MongoDB](#web-scraper--mongodb)
   - [Quant Trading Terminal](#quant-trading-terminal)
   - [Quant Streaming (SSE)](#quant-streaming-sse)
   - [Live Price WebSocket](#live-price-websocket)
6. [Data Models](#data-models)
7. [Services & Tools](#services--tools)
8. [Database Schema](#database-schema)
9. [Frontend Integration](#frontend-integration)
10. [Quick Start](#quick-start)

---

## Architecture Overview

```
Client (React / Postman / curl)
  │
  ▼
FastAPI  (main.py)  ──────────────────────────────────────────────
  │
  ├── /api/auth/*        →  Auth System (JWT + OTP 2FA)
  │     ├─ Signup / Login / Verify OTP / Resend OTP
  │     ├─ Profile CRUD / Change Password / Delete Account
  │     ├─ Watchlist CRUD (max 10 tickers)
  │     └─ Conversations CRUD (chat persistence)
  │
  ├── /api/agent/*       →  AI Agent Engine (OpenAI gpt-4o-mini)
  │     ├─ Rate Limiter (20 req / 60 s per user)
  │     ├─ Safety Guard (risky-query detection)
  │     ├─ Intent Classifier (8 intents + ticker extraction)
  │     ├─ Tool Execution (yfinance / calculators / market / scraper)
  │     ├─ Memory Context (MongoDB session history)
  │     └─ OpenAI LLM Grounding → Response + Disclaimer
  │
  ├── /api/stocks/*      →  yfinance service (quotes, history, info, search)
  ├── /api/market/*      →  Market overview + trend analysis
  ├── /api/calc/*        →  Deterministic calculators (SIP, EMI, compound)
  ├── /api/urls/*        →  OpenAI LLM URL authenticity + CSV store
  ├── /api/scraper/*     →  Web scraper + MongoDB persistence
  │
  ├── /api/quant/*       →  Quant Trading Terminal (20 strategies)
  │     ├─ Strategy Registry (list, run, backtest)
  │     ├─ 5 categories: Trend, Momentum, Mean Reversion, Volatility, ML/Statistical
  │     └─ AI insights via OpenAI / Gemini
  │
  ├── /api/quant/stream/* → SSE Strategy Streaming (step-by-step execution)
  │     ├─ 10 custom step generators + generic fallback
  │     └─ NaN-safe JSON serialization + error handling
  │
  └── /ws/quant/live/*    → WebSocket live price feed
```

### Auth Flow

```
┌─────────┐     POST /signup      ┌─────────────┐
│  Client  │ ──────────────────►  │  Create User │
└─────────┘                       │  (unverified)│
     │                            └──────┬───────┘
     │                                   │
     │         OTP Email (smtplib)       │
     │  ◄────────────────────────────────┘
     │
     │        POST /verify-otp
     │ ──────────────────────────►  Mark verified
     │                               │
     │         JWT Token              │
     │  ◄────────────────────────────┘
     │
     │   Authorization: Bearer <JWT>
     │ ──────────────────────────►  Protected routes
```

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                        ← FastAPI entry-point, 7 routers, CORS
│   ├── auth/
│   │   ├── deps.py                    ← get_current_user JWT dependency
│   │   └── utils.py                   ← JWT, bcrypt passwords, pyotp OTP
│   ├── agents/
│   │   ├── financial_agent.py         ← Core brain: intent→tools→LLM pipeline
│   │   ├── intent_classifier.py       ← Keyword routing (8 intents) + ticker extraction
│   │   ├── memory.py                  ← MongoDB session memory (per user, last 20)
│   │   └── safety.py                  ← Risky-query detection, disclaimers, rate limiter
│   ├── models/
│   │   ├── auth.py                    ← Signup, Login, OTP, Profile, Watchlist, Conversation schemas
│   │   ├── agent.py                   ← Agent, calculator, market, trend schemas
│   │   ├── stock.py                   ← Stock quote / history / info / search schemas
│   │   ├── url.py                     ← URL authenticity schemas
│   │   └── scraper.py                 ← Scraper + MongoDB schemas
│   ├── routes/
│   │   ├── auth.py                    ← 17 auth endpoints (signup → conversations)
│   │   ├── agent.py                   ← POST /api/agent/query (JWT protected)
│   │   ├── stock.py                   ← GET  /api/stocks/*
│   │   ├── market.py                  ← GET  /api/market/*
│   │   ├── calc.py                    ← POST /api/calc/*
│   │   ├── url.py                     ← POST/GET/DELETE /api/urls/*
│   │   └── scraper.py                 ← POST/GET/DELETE /api/scraper/*
│   ├── quant/
│   │   ├── strategies.py              ← 20 registered strategies (5 categories) + compute metrics
│   │   ├── routes.py                  ← REST endpoints: list / run / backtest / AI insights
│   │   ├── stream_router.py           ← SSE streaming endpoint with NaN-safe serialization
│   │   ├── step_generators.py         ← 10 custom + 1 generic step generator for streaming
│   │   └── ws.py                      ← WebSocket live price handler
│   ├── services/
│   │   ├── email.py                   ← OTP email sending via smtplib + Gmail SMTP
│   │   ├── openai_llm.py             ← OpenAI gpt-4o-mini client (agent + URL checks)
│   │   ├── gemini.py                  ← Google Gemini 2.5 Flash client (legacy)
│   │   ├── yfinance/
│   │   │   ├── yf.py                  ← Wrapper: quote, history, info, search
│   │   │   ├── trend.py               ← SMA crossover + volatility analysis
│   │   │   └── market.py              ← 8 major indices / assets overview
│   │   └── calculators/
│   │       ├── sip.py                 ← SIP return calculator
│   │       ├── emi.py                 ← EMI loan calculator
│   │       └── compound.py            ← Compound interest calculator
│   └── tools/
│       ├── db.py                      ← MongoDB Atlas client (pymongo)
│       ├── scraper.py                 ← BeautifulSoup web scraper
│       ├── url_store.py               ← CSV read/write for urls.csv
│       └── urls.csv                   ← Authentic-URL whitelist
├── .env                               ← All environment variables
└── package.json
```

---

## Environment Variables

All variables live in `backend/.env`:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash API key |
| `OPENAI_API_KEY` | OpenAI API key (gpt-4o-mini) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT signing (default provided) |
| `OTP_SECRET` | Base32 secret for pyotp TOTP generation |
| `SMTP_EMAIL` | Gmail sender address |
| `SMTP_PASSWORD` | Gmail App Password (16 chars) |
| `SMTP_HOST` | SMTP server hostname (default: `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (default: `587` for STARTTLS) |

---

## Rate Limiting

The API employs Global Rate Limiting to prevent abuse and ensure stability.

- **Library:** `slowapi` (based on `limits`)
- **Strategy:** Fixed Window
- **Global Limit:** `60 requests per minute` per IP address.
- **Key Function:** `get_remote_address_no_options` (Client IP, exempts OPTIONS)

### Response Headers
When a request is made, the following headers are included:

- `X-RateLimit-Limit`: The limit (e.g., `60`).
- `X-RateLimit-Remaining`: Requests remaining in the current window.
- `X-RateLimit-Reset`: Time (in seconds) until the window resets.

### Exceeding the Limit
If the limit is exceeded, the API returns:

- **Status Code:** `429 Too Many Requests`
- **Body:** `{ "error": "Rate limit exceeded: 20 per 1 minute" }`

---

## Authentication & Security

### JWT Bearer Tokens

- **Library:** `python-jose`
- **Algorithm:** HS256
- **Expiry:** 24 hours
- **Header:** `Authorization: Bearer <token>`
- All protected endpoints use the `get_current_user` FastAPI dependency which:
  1. Extracts the Bearer token
  2. Decodes and validates the JWT
  3. Looks up the user in MongoDB
  4. Verifies the account has completed OTP 2FA

### OTP 2-Factor Authentication

- **Library:** `pyotp` (TOTP)
- **Digits:** 6
- **TTL:** 5 minutes (300 seconds)
- **Delivery:** Gmail SMTP via `smtplib` with STARTTLS
- **Flow:** Signup/Login → OTP emailed → Verify OTP → JWT issued

### Password Security

- **Library:** `bcrypt`
- **Storage:** Only the bcrypt hash is stored in MongoDB (`password_hash` field)

---

## API Endpoints

### Endpoint Summary

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | `GET` | `/` | — | Health check |
| **Auth** |
| 2 | `POST` | `/api/auth/signup` | — | Register new user + send OTP email |
| 3 | `POST` | `/api/auth/login` | — | Login (JWT if verified, else OTP) |
| 4 | `POST` | `/api/auth/verify-otp` | — | Verify OTP → returns JWT |
| 5 | `POST` | `/api/auth/resend-otp` | — | Resend OTP email |
| 6 | `GET` | `/api/auth/profile` | JWT | Get user profile |
| 7 | `PUT` | `/api/auth/profile` | JWT | Update name/phone |
| 8 | `POST` | `/api/auth/change-password` | JWT | Change password |
| 9 | `DELETE` | `/api/auth/account` | JWT | Delete account + all data |
| 10 | `GET` | `/api/auth/watchlist` | JWT | Get watchlist |
| 11 | `PUT` | `/api/auth/watchlist` | JWT | Replace entire watchlist |
| 12 | `POST` | `/api/auth/watchlist/add` | JWT | Add ticker to watchlist |
| 13 | `DELETE` | `/api/auth/watchlist/{ticker}` | JWT | Remove ticker |
| 14 | `GET` | `/api/auth/conversations` | JWT | List conversations |
| 15 | `POST` | `/api/auth/conversations` | JWT | Create conversation |
| 16 | `GET` | `/api/auth/conversations/{id}` | JWT | Get conversation + messages |
| 17 | `POST` | `/api/auth/conversations/{id}/message` | JWT | Add message |
| 18 | `DELETE` | `/api/auth/conversations/{id}` | JWT | Delete conversation |
| **Agent** |
| 19 | `POST` | `/api/agent/query` | JWT | AI agent query |
| **Stocks** |
| 20 | `GET` | `/api/stocks/search?q=` | — | Search tickers |
| 21 | `GET` | `/api/stocks/{ticker}/quote` | — | Latest quote |
| 22 | `GET` | `/api/stocks/{ticker}/history` | — | OHLCV history |
| 23 | `GET` | `/api/stocks/{ticker}/info` | — | Company info |
| **Market** |
| 24 | `GET` | `/api/market/overview` | — | Major indices & assets |
| 25 | `GET` | `/api/market/trend/{ticker}` | — | Trend analysis |
| **Calculators** |
| 26 | `POST` | `/api/calc/sip` | — | SIP calculator |
| 27 | `POST` | `/api/calc/emi` | — | EMI calculator |
| 28 | `POST` | `/api/calc/compound` | — | Compound interest |
| **URLs** |
| 29 | `POST` | `/api/urls/check` | — | URL authenticity (OpenAI) |
| 30 | `GET` | `/api/urls/` | — | List stored URLs |
| 31 | `DELETE` | `/api/urls/?url=` | — | Remove a URL |
| **Scraper** |
| 32 | `POST` | `/api/scraper/scrape` | — | Scrape URLs → MongoDB |
| 33 | `POST` | `/api/scraper/scrape-csv` | — | Scrape from urls.csv |
| 34 | `GET` | `/api/scraper/data` | — | All scraped documents |
| 35 | `GET` | `/api/scraper/data/search?q=` | — | Search scraped data |
| 36 | `GET` | `/api/scraper/data/{url}` | — | Single document |
| 37 | `DELETE` | `/api/scraper/data/{url}` | — | Delete document |
| 38 | `GET` | `/api/scraper/stats` | — | Collection stats |
| **Quant Terminal** |
| 39 | `GET` | `/api/quant/strategies` | — | List all 20 strategies |
| 40 | `POST` | `/api/quant/run` | — | Execute strategy on ticker data |
| 41 | `POST` | `/api/quant/backtest` | — | Run backtest with equity curve |
| 42 | `POST` | `/api/quant/ai-insight` | — | AI-powered strategy analysis |
| 43 | `GET` | `/api/quant/stream/run` | — | SSE stream strategy execution |
| 44 | `WS` | `/ws/quant/live/{ticker}` | — | WebSocket live prices |

---

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Returns `{"status": "ok", "version": "2.0.0"}` |

---

### Auth — Signup / Login / OTP / Profile

**Prefix:** `/api/auth`

#### `POST /api/auth/signup`

Register a new user. Sends a 6-digit OTP to the provided email.

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePass123!"
}
```

**Response:**

```json
{
  "message": "Account created. Please verify the OTP sent to your email.",
  "email": "john@example.com"
}
```

**Errors:** `400` Email already registered · `422` Validation error

---

#### `POST /api/auth/login`

Authenticate with email + password. If already verified, returns JWT directly. If not, sends OTP.

**Request Body:**

```json
{ "email": "john@example.com", "password": "SecurePass123!" }
```

**Response (verified user):**

```json
{
  "message": "Login successful",
  "email": "john@example.com",
  "token": "eyJhbGciOiJI...",
  "user": { "name": "John Doe", "email": "john@example.com" }
}
```

**Response (unverified user):**

```json
{
  "message": "OTP sent to your email for verification",
  "email": "john@example.com"
}
```

**Errors:** `401` Invalid email or password

---



#### `POST /api/auth/verify-otp`

Complete 2FA verification. Returns JWT on success.

**Request Body:**

```json
{ "email": "john@example.com", "otp": "482917" }
```

**Response:**

```json
{
  "message": "Verification successful",
  "token": "eyJhbGciOiJI...",
  "user": { "name": "John Doe", "email": "john@example.com" }
}
```

**Errors:** `400` Invalid or expired OTP · `404` User not found

---

#### `POST /api/auth/resend-otp`

Regenerate and resend OTP.

**Request Body:** `{ "email": "john@example.com" }`

**Response:** `{ "message": "New OTP sent to your email", "email": "john@example.com" }`

---

#### `GET /api/auth/profile` 🔒

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "watchlist": ["AAPL", "TSLA"],
  "chat_count": 5,
  "created_at": "2026-02-13T10:30:00+00:00"
}
```

---

#### `PUT /api/auth/profile` 🔒

Update name and/or phone.

**Request Body:** `{ "name": "Jane Doe", "phone": "1234567890" }`

**Response:** `{ "message": "Profile updated" }`

---

#### `POST /api/auth/change-password` 🔒

**Request Body:** `{ "current_password": "OldPass", "new_password": "NewPass" }`

**Response:** `{ "message": "Password changed successfully" }`

**Errors:** `400` Current password is incorrect

---

#### `DELETE /api/auth/account` 🔒

Permanently deletes user account, conversations, and session memory.

**Response:** `{ "message": "Account permanently deleted" }`

---

#### Watchlist Endpoints 🔒

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/watchlist` | — | `{ "watchlist": ["AAPL", "TSLA"] }` |
| `PUT` | `/api/auth/watchlist` | `{ "tickers": ["MSFT", "AMZN"] }` | Replace entire list (max 10) |
| `POST` | `/api/auth/watchlist/add` | `{ "ticker": "GOOGL" }` | Add single ticker |
| `DELETE` | `/api/auth/watchlist/{ticker}` | — | Remove ticker |

---

#### Conversation Endpoints 🔒

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/conversations` | List all (newest first) |
| `POST` | `/api/auth/conversations` | Create new empty conversation |
| `GET` | `/api/auth/conversations/{id}` | Get with all messages |
| `POST` | `/api/auth/conversations/{id}/message` | Append message `{ "role": "user"\|"assistant", "content": "..." }` |
| `DELETE` | `/api/auth/conversations/{id}` | Delete conversation |

Auto-title: First user message becomes the conversation title (truncated to 60 chars).

---

### Agent Engine

**Prefix:** `/api/agent`

#### `POST /api/agent/query` 🔒

The unified AI endpoint. Requires JWT. Routes through: rate limiting → safety check → intent classification → tool execution → memory context → OpenAI LLM grounding → response with disclaimer.

**8 intents:** `stock_quote` · `stock_analysis` · `financial_education` · `loan_query` · `market_status` · `news_query` · `calculator` · `general_finance`

**Request Body:**

```json
{ "query": "Should I buy AAPL?" }
```

**Response:**

```json
{
  "response": "Based on AAPL's current data:\n- Price: $261.54 ...\n\n⚠️ Disclaimer: ...",
  "intent": "stock_analysis",
  "tools_used": ["stock_quote", "stock_history", "trend_analysis", "company_info"],
  "tickers": ["AAPL"]
}
```

**Pipeline:**

| Step | Component | Description |
|------|-----------|-------------|
| 1 | Rate Limiter | 20 requests / 60 seconds per user |
| 2 | Safety Guard | Detects risky queries (guaranteed returns, insider tips, etc.) |
| 3 | Intent Classifier | Keyword-based routing into 8 intents + ticker extraction |
| 4 | Ticker Normalization | Alias map (SENSEX→^BSESN), yfinance search, NSE (.NS) fallback |
| 5 | Tool Execution | Calls yfinance, calculators, market, scraper based on intent |
| 6 | Memory | Loads last 3 interactions from MongoDB for conversational context |
| 7 | OpenAI LLM | Sends structured data + context to gpt-4o-mini |
| 8 | Disclaimer | Appends financial disclaimer to stock/finance responses |

---

### Stocks (yfinance)

**Prefix:** `/api/stocks`

#### `GET /api/stocks/search?q={query}`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | query | Yes | Company name or partial ticker |

**Response:** `SearchResult[]`

```json
[{ "symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "type": "EQUITY" }]
```

---

#### `GET /api/stocks/{ticker}/quote`

**Response:** `StockQuote`

```json
{
  "ticker": "AAPL", "name": "Apple Inc.", "price": 261.54,
  "previous_close": 275.5, "open": 260.0,
  "day_high": 263.0, "day_low": 258.0,
  "volume": 51397410, "market_cap": 3930000000000,
  "pe_ratio": 34.83, "dividend_yield": 0.49,
  "52_week_high": 280.0, "52_week_low": 164.08,
  "currency": "USD", "exchange": "NMS"
}
```

---

#### `GET /api/stocks/{ticker}/history`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | query | `1mo` | `1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max` |
| `interval` | query | `1d` | `1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo` |

**Response:** `HistoryRecord[]`

```json
[{ "date": "2026-02-10 00:00:00-05:00", "open": 260.0, "high": 263.0, "low": 258.0, "close": 261.54, "volume": 51397410 }]
```

---

#### `GET /api/stocks/{ticker}/info`

**Response:** `CompanyInfo`

```json
{
  "ticker": "MSFT", "name": "Microsoft Corporation",
  "sector": "Technology", "industry": "Software - Infrastructure",
  "country": "United States", "website": "https://www.microsoft.com",
  "description": "Microsoft Corporation develops...",
  "employees": 228000, "market_cap": 3005430628352
}
```

---

### Market Overview & Trends

**Prefix:** `/api/market`

#### `GET /api/market/overview`

Live prices for 8 major assets: S&P 500, NASDAQ, Dow Jones, NIFTY 50, SENSEX, Bitcoin, Gold, Crude Oil.

**Response:** `MarketItem[]`

```json
[
  { "name": "S&P 500", "ticker": "^GSPC", "price": 5321.41, "previous_close": 5298.76, "change": 22.65, "change_pct": 0.43, "currency": "USD" },
  { "name": "Bitcoin", "ticker": "BTC-USD", "price": 104523.00, "previous_close": 103108.00, "change": 1415.00, "change_pct": 1.37, "currency": "USD" }
]
```

---

#### `GET /api/market/trend/{ticker}`

Trend analysis: SMA crossover direction + volatility + support/resistance.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | query | `1mo` | `1d, 5d, 1mo, 3mo, 6mo, 1y` |
| `interval` | query | `1d` | `1d, 1wk, 1mo` |

**Response:** `TrendResponse`

```json
{
  "direction": "UPTREND",
  "volatility_score": 0.34,
  "price_change_pct": 5.12,
  "avg_volume": 48523100,
  "support": 189.20,
  "resistance": 199.80,
  "summary": "The asset is in a UPTREND (SMA-10 vs SMA-30)..."
}
```

---

### Calculators (SIP / EMI / Compound)

**Prefix:** `/api/calc` — All deterministic, no API keys needed.

#### `POST /api/calc/sip`

```json
{ "monthly_investment": 5000, "annual_return_rate": 12, "years": 10 }
```

**Response:**

```json
{
  "monthly_investment": 5000, "annual_return_rate": 12, "years": 10,
  "total_months": 120, "total_invested": 600000,
  "estimated_returns": 561695.38, "total_value": 1161695.38
}
```

#### `POST /api/calc/emi`

```json
{ "principal": 1000000, "annual_interest_rate": 8.5, "tenure_months": 240 }
```

**Response:**

```json
{
  "principal": 1000000, "annual_interest_rate": 8.5, "tenure_months": 240,
  "emi": 8678.23, "total_payment": 2082775.20, "total_interest": 1082775.20
}
```

#### `POST /api/calc/compound`

```json
{ "principal": 100000, "annual_rate": 7, "years": 5, "compounding_frequency": 12 }
```

**Response:**

```json
{
  "principal": 100000, "annual_rate": 7, "years": 5, "compounding_frequency": 12,
  "final_amount": 141478.44, "interest_earned": 41478.44, "effective_annual_rate": 7.23
}
```

---

### URL Authenticity (OpenAI LLM)

**Prefix:** `/api/urls`

#### `POST /api/urls/check`

Submit URLs for OpenAI LLM authenticity assessment. Authentic URLs are saved to `urls.csv`.

```json
{ "urls": ["https://reuters.com", "https://fake-finance-scam.xyz"] }
```

**Response:**

```json
{
  "results": [
    { "url": "https://reuters.com", "is_authentic": true, "confidence": 1.0, "category": "news", "reason": "Reuters is a globally recognized news agency." },
    { "url": "https://fake-finance-scam.xyz", "is_authentic": false, "confidence": 1.0, "category": "unknown", "reason": "Domain contains 'fake' and 'scam'." }
  ],
  "saved": [],
  "skipped_duplicates": ["https://reuters.com"]
}
```

#### `GET /api/urls/`

List all URLs in `urls.csv`. Returns `{ "urls": [...], "count": N }`.

#### `DELETE /api/urls/?url={url}`

Remove a URL from `urls.csv`.

---

### Web Scraper + MongoDB

**Prefix:** `/api/scraper`

#### `POST /api/scraper/scrape`

```json
{ "urls": ["https://investopedia.com"] }
```

**Response:**

```json
{
  "total": 1, "succeeded": 1, "failed": 0,
  "results": [{ "url": "https://investopedia.com", "title": "Investopedia", "success": true, "saved": true }]
}
```

#### `POST /api/scraper/scrape-csv?limit={n}` — Scrape first `n` URLs from `urls.csv` (default 5).

#### `GET /api/scraper/data` — All scraped documents.

#### `GET /api/scraper/data/search?q={term}&limit={n}` — Search by title/URL keyword.

#### `GET /api/scraper/data/{url}` — Single document by URL.

#### `DELETE /api/scraper/data/{url}` — Delete document by URL.

#### `GET /api/scraper/stats` — `{ "collection": "scraped_data", "document_count": 93 }`

---

### Quant Trading Terminal

**Prefix:** `/api/quant`

#### `GET /api/quant/strategies`

Returns all 20 registered strategies grouped by category.

**Response:**

```json
[
  {
    "key": "ma_crossover",
    "name": "Moving Average Crossover",
    "category": "Trend Following",
    "description": "Generates signals when fast SMA crosses above/below slow SMA.",
    "default_params": { "fast_period": 10, "slow_period": 30 }
  }
]
```

**All 20 Strategies:**

| # | Key | Name | Category |
|---|-----|------|----------|
| 1 | `ma_crossover` | Moving Average Crossover | Trend Following |
| 2 | `ema_strategy` | EMA Strategy | Trend Following |
| 3 | `macd_signal` | MACD Signal | Trend Following |
| 4 | `supertrend` | SuperTrend | Trend Following |
| 5 | `donchian_breakout` | Donchian Breakout | Trend Following |
| 6 | `rsi_strategy` | RSI Strategy | Momentum |
| 7 | `stochastic` | Stochastic Oscillator | Momentum |
| 8 | `roc_strategy` | Rate of Change | Momentum |
| 9 | `cci_strategy` | Commodity Channel Index | Momentum |
| 10 | `bollinger_reversion` | Bollinger Band Reversion | Mean Reversion |
| 11 | `zscore_reversion` | Z-Score Reversion | Mean Reversion |
| 12 | `vwap_reversion` | VWAP Reversion | Mean Reversion |
| 13 | `atr_breakout` | ATR Breakout | Volatility |
| 14 | `keltner_channel` | Keltner Channel | Volatility |
| 15 | `volume_spike` | Volume Spike | Market Microstructure |
| 16 | `order_imbalance` | Order Imbalance | Market Microstructure |
| 17 | `kalman_filter` | Kalman Filter | Statistical / Quant |
| 18 | `hmm_regime` | HMM Regime Detection | Statistical / Quant |
| 19 | `lstm_proxy` | LSTM Neural Network (Proxy) | ML-Proxy |
| 20 | `gbm_proxy` | Gradient Boosted Model (Proxy) | ML-Proxy |

---

#### `POST /api/quant/run`

Run a strategy against historical ticker data (non-streaming).

**Request Body:**

```json
{
  "ticker": "AAPL",
  "strategy": "ma_crossover",
  "period": "6mo",
  "interval": "1d",
  "params": { "fast_period": 10, "slow_period": 30 }
}
```

**Response:**

```json
{
  "signals": [{ "date": "2026-01-15", "type": "BUY", "price": 248.50 }],
  "metrics": {
    "sharpe_ratio": 1.25, "max_drawdown": -5.2, "win_rate": 0.62,
    "total_trades": 8, "profit_factor": 1.8,
    "avg_win": 12.50, "avg_loss": -7.30, "risk_level": "Moderate",
    "confidence": 0.72, "verdict": "Bullish bias detected..."
  },
  "indicator_data": { "fast_sma": [...], "slow_sma": [...] }
}
```

---

#### `POST /api/quant/backtest`

Backtest strategy with equity curve and detailed performance metrics.

**Request Body:** Same as `/run`

**Response:** Same as `/run` + `equity_curve[]` with time-series portfolio values.

---

#### `POST /api/quant/ai-insight`

Generate AI-powered analysis of strategy results using OpenAI/Gemini.

**Request Body:**

```json
{
  "ticker": "AAPL",
  "strategy": "ma_crossover",
  "metrics": { "sharpe_ratio": 1.25, "win_rate": 0.62 }
}
```

**Response:** `{ "insight": "Based on the MA Crossover analysis..." }`

---

### Quant Streaming (SSE)

**Prefix:** `/api/quant/stream`

#### `GET /api/quant/stream/run`

Server-Sent Events endpoint that streams strategy execution step-by-step.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ticker` | query | required | Stock ticker (e.g., `AAPL`) |
| `strategy` | query | required | Strategy key (e.g., `ma_crossover`) |
| `period` | query | `6mo` | Data period |
| `interval` | query | `1d` | Data interval |
| `params` | query | `""` | JSON-encoded strategy parameters |

**SSE Event Types:**

| Event | Description |
|-------|-------------|
| `step` | Intermediate execution step |
| `complete` | Final result with signals, metrics, indicators |
| `error` | Error occurred during execution |

**Step Event Data:**

```json
{
  "step": 2, "total": 6,
  "title": "Computing Fast SMA(10)",
  "detail": "Smoothing price with 10-period simple moving average",
  "progress": 30,
  "indicator": { "fast_sma": [241.5, 242.3, ...] }
}
```

**Complete Event Data:**

```json
{
  "step": 6, "total": 6,
  "title": "Analysis Complete",
  "progress": 100,
  "final": true,
  "signals": [...],
  "metrics": { "sharpe_ratio": 1.25, ... },
  "indicator_data": { "fast_sma": [...], "slow_sma": [...] },
  "output_type": "trend",
  "output": { "direction": "BULLISH", "strength": 2.3 }
}
```

**Output Types by Strategy Category:**

| Category | `output_type` | Output Fields |
|----------|--------------|---------------|
| Trend Following | `trend` | `direction`, `strength`, `fast_val`, `slow_val` |
| Momentum | `momentum` | `zone`, `rsi_value`, `overbought`, `oversold` |
| Mean Reversion | `mean_reversion` | `distance_from_mean`, `bandwidth_pct`, `position` |
| Volatility | `volatility` | `regime`, `current_atr`, `median_atr`, `breakout_prob` |
| ML-Proxy | `ml` | `prediction`, `confidence_score`, `features` |
| Statistical | `statistical` | `filter_state`, `estimated_price`, `velocity` |
| Generic fallback | `generic` | `total_signals`, `net_direction` |

---

### Live Price WebSocket

#### `WS /ws/quant/live/{ticker}`

Real-time price streaming via WebSocket.

**Connection:** `ws://localhost:8000/ws/quant/live/AAPL`

**Server Messages (JSON):**

```json
{
  "type": "price_update",
  "data": {
    "price": 261.54, "change": -14.96, "change_pct": -5.41,
    "volume": 51397410, "high": 263.0, "low": 258.0,
    "timestamp": "2026-02-13T06:00:00"
  }
}
```

**Client Commands:** JSON with `"type": "ping"` for keepalive.

---

## Data Models

### Auth Models (`app/models/auth.py`)

| Model | Fields |
|-------|--------|
| `SignupRequest` | name, email (EmailStr), phone, password |
| `SignupResponse` | message, email |
| `LoginRequest` | email (EmailStr), password |
| `LoginResponse` | message, email, token?, user? |
| `OtpVerifyRequest` | email (EmailStr), otp |
| `OtpVerifyResponse` | message, token, user |
| `ResendOtpRequest` | email (EmailStr) |
| `UserProfile` | name, email, phone, watchlist[], chat_count, created_at? |
| `UpdateProfileRequest` | name?, phone? |
| `ChangePasswordRequest` | current_password, new_password |
| `WatchlistUpdateRequest` | tickers[] |
| `WatchlistAddRequest` | ticker |
| `ConversationSummary` | id, title, preview, message_count, updated_at? |
| `ConversationDetail` | id, title, messages[], created_at?, updated_at? |

### Agent Models (`app/models/agent.py`)

| Model | Fields |
|-------|--------|
| `AgentQueryRequest` | query, user_id |
| `AgentQueryResponse` | response, intent, tools_used[], tickers[] |
| `SipRequest/Response` | monthly_investment, annual_return_rate, years + totals |
| `EmiRequest/Response` | principal, annual_interest_rate, tenure_months + emi/totals |
| `CompoundRequest/Response` | principal, annual_rate, years, compounding_frequency + results |
| `MarketItem` | name, ticker, price, previous_close, change, change_pct, currency |
| `TrendResponse` | direction, volatility_score, price_change_pct, avg_volume, support, resistance, summary |

### Stock Models (`app/models/stock.py`)

| Model | Fields |
|-------|--------|
| `StockQuote` | ticker, name, price, previous_close, open, day_high, day_low, volume, market_cap, pe_ratio, dividend_yield, 52_week_high, 52_week_low, currency, exchange |
| `HistoryRecord` | date, open, high, low, close, volume |
| `CompanyInfo` | ticker, name, sector, industry, country, website, description, employees, market_cap, enterprise_value |
| `SearchResult` | symbol, name, exchange, type |

### URL & Scraper Models

| Model | Fields |
|-------|--------|
| `UrlSubmission` | urls[] |
| `AuthenticityResult` | url, is_authentic, confidence, category?, reason? |
| `UrlCheckResponse` | results[], saved[], skipped_duplicates[] |
| `UrlListResponse` | urls[], count |
| `ScrapeRequest` | urls[] |
| `ScrapedDocument` | url, title, text |
| `ScrapeResultItem` | url, title?, success, saved, error? |
| `ScrapeResponse` | total, succeeded, failed, results[] |
| `DbStatsResponse` | collection, document_count |

---

## Services & Tools

### Services

| Service | File | Description |
|---------|------|-------------|
| **OpenAI LLM** | `services/openai_llm.py` | gpt-4o-mini for agent responses + URL authenticity |
| **Email** | `services/email.py` | Gmail SMTP via smtplib + STARTTLS, HTML OTP templates |
| **Gemini LLM** | `services/gemini.py` | Google Gemini 2.5 Flash (legacy) |
| **yfinance** | `services/yfinance/yf.py` | quote, history, info, search |
| **Trend Analyzer** | `services/yfinance/trend.py` | SMA crossover, volatility, support/resistance |
| **Market Overview** | `services/yfinance/market.py` | 8 major indices/assets live prices |
| **Calculators** | `services/calculators/` | SIP, EMI, Compound interest |

### Quant Components

| Component | File | Description |
|-----------|------|-------------|
| **Strategy Engine** | `quant/strategies.py` | 20 strategies in 6 categories with decorator-based registry |
| **Quant Router** | `quant/routes.py` | REST APIs for strategy listing, execution, backtesting, AI insights |
| **Stream Router** | `quant/stream_router.py` | SSE endpoint with NaN-safe serialization and error handling |
| **Step Generators** | `quant/step_generators.py` | 10 custom + 1 generic step generator for streaming execution |
| **Live WebSocket** | `quant/ws.py` | yfinance-powered live price streaming via WebSocket |

### Agent Components

| Component | File | Description |
|-----------|------|-------------|
| **Financial Agent** | `agents/financial_agent.py` | Intent → ticker normalization → tools → memory → LLM → disclaimer |
| **Intent Classifier** | `agents/intent_classifier.py` | Keyword scoring (8 intents) + regex ticker extraction |
| **Memory** | `agents/memory.py` | MongoDB `user_sessions`, last 20 interactions per user |
| **Safety** | `agents/safety.py` | Risky-query regex patterns, rate limiter (20/60s), disclaimer |

### Auth Components

| Component | File | Description |
|-----------|------|-------------|
| **Utils** | `auth/utils.py` | bcrypt passwords, JWT encode/decode, pyotp TOTP OTP |
| **Dependency** | `auth/deps.py` | `get_current_user` — token → DB lookup → verified check |

### Tools

| Tool | File | Description |
|------|------|-------------|
| **MongoDB** | `tools/db.py` | PyMongo → `bidathon_db`, shared `db` object |
| **Web Scraper** | `tools/scraper.py` | requests + BeautifulSoup |
| **URL Store** | `tools/url_store.py` | CSV read/write/deduplicate for urls.csv |

---

## Database Schema

**Database:** `bidathon_db` (MongoDB Atlas)

### Collections

#### `users`

```json
{
  "_id": "ObjectId",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password_hash": "$2b$12$...",
  "is_verified": true,
  "otp": "482917",
  "otp_expiry": 1739438400.0,
  "watchlist": ["AAPL", "TSLA"],
  "created_at": "2026-02-13T10:30:00+00:00"
}
```

#### `conversations`

```json
{
  "_id": "ObjectId",
  "user_email": "john@example.com",
  "title": "What is AAPL's current price?",
  "preview": "What is AAPL's current price?",
  "messages": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "message_count": 2,
  "created_at": "...",
  "updated_at": "..."
}
```

#### `user_sessions`

```json
{
  "_id": "ObjectId",
  "user_id": "john@example.com",
  "interactions": [
    { "query": "Price of AAPL?", "intent": "stock_quote", "response_summary": "..." }
  ]
}
```

#### `scraped_data`

```json
{
  "_id": "ObjectId",
  "url": "https://investopedia.com",
  "title": "Investopedia",
  "text": "Full page text..."
}
```

---

## Frontend Integration

The React frontend (`frontend/finally/`) communicates via `src/services/api.js`:

- **Token Management:** JWT stored in `localStorage` as `finally_token`
- **Auto-attach:** Every request adds `Authorization: Bearer <token>` if available
- **Auto-logout:** 401/403 responses trigger `logout()` (except login/signup)
- **CORS:** Backend allows all origins (`allow_origins=["*"]`)

All frontend API functions map 1:1 to backend routes.

---

## Quick Start

```bash
cd backend

python -m venv ../.venv
../.venv/Scripts/activate        # Windows
# source ../.venv/bin/activate   # macOS/Linux

pip install fastapi uvicorn yfinance beautifulsoup4 requests pymongo \
  python-dotenv google-genai pydantic openai python-jose[cryptography] \
  bcrypt pyotp pydantic[email]

# Configure .env with: OPENAI_API_KEY, MONGO_URI, SMTP_EMAIL, SMTP_PASSWORD

python -m uvicorn app.main:app --reload
# Open http://localhost:8000/docs
```
