# FinAlly — Testing Guide

How to test every endpoint using **Postman**, **curl**, or **PowerShell**.

> **Base URL:** `http://localhost:8000`
> Start the server: `cd backend && python -m uvicorn app.main:app --reload`

---

## Table of Contents

1. [Health Check](#1-health-check)
2. [Auth — Signup](#2-auth--signup)
3. [Auth — Login](#3-auth--login)
4. [Auth — OTP Verification](#4-auth--otp-verification)
5. [Auth — Resend OTP](#5-auth--resend-otp)
6. [Auth — Profile](#6-auth--profile)
7. [Auth — Change Password](#7-auth--change-password)
8. [Auth — Delete Account](#8-auth--delete-account)
9. [Auth — Watchlist](#9-auth--watchlist)
10. [Auth — Conversations](#10-auth--conversations)
11. [Agent Engine](#11-agent-engine)
12. [Stocks](#12-stocks)
13. [Market Overview & Trends](#13-market-overview--trends)
14. [Calculators](#14-calculators)
15. [URL Authenticity](#15-url-authenticity)
16. [Web Scraper + MongoDB](#16-web-scraper--mongodb)
17. [Full Auth Workflow](#17-full-auth-workflow)
18. [Quant Trading Terminal](#18-quant-trading-terminal)
19. [Quant SSE Streaming](#19-quant-sse-streaming)
20. [Quant WebSocket Live Feed](#20-quant-websocket-live-feed)

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

**Expected:**
```json
{ "status": "ok", "version": "2.0.0" }
```

---

## 2. Auth — Signup

### `POST /api/auth/signup`

**curl:**
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "phone": "9876543210", "password": "Test1234!"}'
```

**PowerShell:**
```powershell
$body = @{ name="Test User"; email="test@example.com"; phone="9876543210"; password="Test1234!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/auth/signup -Body $body -ContentType "application/json"
```

**Expected:**
```json
{
  "message": "Account created. Please verify the OTP sent to your email.",
  "email": "test@example.com"
}
```

**Error cases:**
- Duplicate email → `400` `"Email already registered"`
- Missing fields → `422` validation error

---

## 3. Auth — Login

### `POST /api/auth/login`

**curl:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test1234!"}'
```

**Expected (verified user):**
```json
{
  "message": "Login successful",
  "email": "test@example.com",
  "token": "eyJhbGciOiJI...",
  "user": { "name": "Test User", "email": "test@example.com" }
}
```

**Expected (unverified user):**
```json
{
  "message": "OTP sent to your email for verification",
  "email": "test@example.com"
}
```

**Error cases:**
- Wrong password → `401` `"Invalid email or password"`
- Non-existent email → `401` `"Invalid email or password"`



## 4. Auth — OTP Verification

### `POST /api/auth/verify-otp`

**curl:**
```bash
curl -X POST http://localhost:8000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "otp": "123456"}'
```

**Expected:**
```json
{
  "message": "Verification successful",
  "token": "eyJhbGciOiJI...",
  "user": { "name": "Test User", "email": "test@example.com" }
}
```

**Error cases:**
- Wrong OTP → `400` `"Invalid or expired OTP"`
- Expired OTP (>5 min) → `400` `"Invalid or expired OTP"`
- Unknown email → `404` `"User not found"`

> **Tip:** For automated testing, retrieve the OTP directly from MongoDB:
> ```python
> from pymongo import MongoClient
> user = MongoClient(MONGO_URI)["bidathon_db"]["users"].find_one({"email": "test@example.com"})
> print(user["otp"])
> ```

---

## 5. Auth — Resend OTP

### `POST /api/auth/resend-otp`

**curl:**
```bash
curl -X POST http://localhost:8000/api/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Expected:** `{ "message": "New OTP sent to your email", "email": "test@example.com" }`

---

## 6. Auth — Profile

> All profile endpoints require `Authorization: Bearer <token>` header.

### `GET /api/auth/profile`

**curl:**
```bash
curl http://localhost:8000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**PowerShell:**
```powershell
$headers = @{ Authorization = "Bearer YOUR_TOKEN" }
Invoke-RestMethod http://localhost:8000/api/auth/profile -Headers $headers
```

**Expected:**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "9876543210",
  "watchlist": [],
  "chat_count": 0,
  "created_at": "2026-02-13T..."
}
```

### `PUT /api/auth/profile`

**curl:**
```bash
curl -X PUT http://localhost:8000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "phone": "1111111111"}'
```

**Expected:** `{ "message": "Profile updated" }`

---

## 7. Auth — Change Password

### `POST /api/auth/change-password`

**curl:**
```bash
curl -X POST http://localhost:8000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password": "Test1234!", "new_password": "NewPass5678!"}'
```

**Expected:** `{ "message": "Password changed successfully" }`

**Error:** Wrong current password → `400` `"Current password is incorrect"`

---

## 8. Auth — Delete Account

### `DELETE /api/auth/account`

**curl:**
```bash
curl -X DELETE http://localhost:8000/api/auth/account \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** `{ "message": "Account permanently deleted" }`

Deletes: user document, all conversations, session memory.

---

## 9. Auth — Watchlist

> All watchlist endpoints require JWT.

### `GET /api/auth/watchlist`

```bash
curl http://localhost:8000/api/auth/watchlist -H "Authorization: Bearer TOKEN"
```

**Expected:** `{ "watchlist": [] }`

### `POST /api/auth/watchlist/add`

```bash
curl -X POST http://localhost:8000/api/auth/watchlist/add \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL"}'
```

**Expected:** `{ "message": "Added AAPL", "watchlist": ["AAPL"] }`

### `PUT /api/auth/watchlist`

```bash
curl -X PUT http://localhost:8000/api/auth/watchlist \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tickers": ["MSFT", "TSLA", "AMZN"]}'
```

**Expected:** `{ "watchlist": ["MSFT", "TSLA", "AMZN"] }`

### `DELETE /api/auth/watchlist/{ticker}`

```bash
curl -X DELETE http://localhost:8000/api/auth/watchlist/TSLA \
  -H "Authorization: Bearer TOKEN"
```

**Expected:** `{ "message": "Removed TSLA", "watchlist": ["MSFT", "AMZN"] }`

---

## 10. Auth — Conversations

> All conversation endpoints require JWT.

### `POST /api/auth/conversations` — Create

```bash
curl -X POST http://localhost:8000/api/auth/conversations \
  -H "Authorization: Bearer TOKEN"
```

**Expected:** `{ "id": "...", "title": "New Conversation", "preview": "", "message_count": 0 }`

### `GET /api/auth/conversations` — List All

```bash
curl http://localhost:8000/api/auth/conversations -H "Authorization: Bearer TOKEN"
```

### `GET /api/auth/conversations/{id}` — Get with Messages

```bash
curl http://localhost:8000/api/auth/conversations/CONVO_ID \
  -H "Authorization: Bearer TOKEN"
```

### `POST /api/auth/conversations/{id}/message` — Add Message

```bash
curl -X POST http://localhost:8000/api/auth/conversations/CONVO_ID/message \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "What is AAPL price?"}'
```

### `DELETE /api/auth/conversations/{id}` — Delete

```bash
curl -X DELETE http://localhost:8000/api/auth/conversations/CONVO_ID \
  -H "Authorization: Bearer TOKEN"
```

---

## 11. Agent Engine

### `POST /api/agent/query` (JWT required)

**curl:**
```bash
curl -X POST http://localhost:8000/api/agent/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Should I buy AAPL?"}'
```

**PowerShell:**
```powershell
$headers = @{ Authorization = "Bearer YOUR_TOKEN" }
$body = @{ query = "Should I buy AAPL?" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/agent/query -Body $body -ContentType "application/json" -Headers $headers
```

**Expected:** Response with `intent`, `tools_used`, `tickers`, and a grounded `response` with disclaimer.

### Agent Queries to Try

| Query | Expected Intent | Notes |
|-------|----------------|-------|
| `"What is the price of TSLA?"` | `stock_quote` | Live TSLA price |
| `"Should I buy AAPL?"` | `stock_analysis` | Full analysis with quote + trend + company info |
| `"Compare AAPL and GOOGL"` | `general_finance` | Multi-ticker comparison |
| `"What is a mutual fund?"` | `financial_education` | LLM explains concept |
| `"Calculate SIP for 5000/month at 12% for 10 years"` | `calculator` | Calculator guidance |
| `"How is the market doing today?"` | `market_status` | Market overview |
| `"Latest news on MSFT"` | `news_query` | Searches scraped data |
| `"Calculate EMI for 10 lakh at 8.5% for 20 years"` | `loan_query` | Loan guidance |
| `"How to get rich quick with crypto?"` | (blocked) | Safety guard intercepts |

### Rate Limiting

Send 21 rapid requests with the same token to trigger the rate limiter (20 req / 60s per user).

---

## 12. Stocks

### `GET /api/stocks/search?q=apple`

```bash
curl "http://localhost:8000/api/stocks/search?q=apple"
```

**Expected:** Array of matching tickers (AAPL, APLE, etc.)

### `GET /api/stocks/{ticker}/quote`

```bash
curl http://localhost:8000/api/stocks/AAPL/quote
```

**Expected:** Live quote with price, volume, market_cap, pe_ratio, etc.

### `GET /api/stocks/{ticker}/history`

```bash
curl "http://localhost:8000/api/stocks/AAPL/history?period=5d&interval=1d"
```

**Expected:** Array of OHLCV records.

### `GET /api/stocks/{ticker}/info`

```bash
curl http://localhost:8000/api/stocks/MSFT/info
```

**Expected:** Company details — sector, industry, description, employees.

---

## 13. Market Overview & Trends

### `GET /api/market/overview`

```bash
curl http://localhost:8000/api/market/overview
```

**Expected:** 8 items — S&P 500, NASDAQ, Dow Jones, NIFTY 50, SENSEX, BTC, Gold, Crude Oil.

### `GET /api/market/trend/{ticker}`

```bash
curl "http://localhost:8000/api/market/trend/AAPL?period=1mo&interval=1d"
```

**Expected:** `direction`, `volatility_score`, `support`, `resistance`, `summary`.

---

## 14. Calculators

### `POST /api/calc/sip`

```bash
curl -X POST http://localhost:8000/api/calc/sip \
  -H "Content-Type: application/json" \
  -d '{"monthly_investment": 5000, "annual_return_rate": 12, "years": 10}'
```

### `POST /api/calc/emi`

```bash
curl -X POST http://localhost:8000/api/calc/emi \
  -H "Content-Type: application/json" \
  -d '{"principal": 1000000, "annual_interest_rate": 8.5, "tenure_months": 240}'
```

### `POST /api/calc/compound`

```bash
curl -X POST http://localhost:8000/api/calc/compound \
  -H "Content-Type: application/json" \
  -d '{"principal": 100000, "annual_rate": 7, "years": 5, "compounding_frequency": 12}'
```

---

## 15. URL Authenticity

### `POST /api/urls/check`

```bash
curl -X POST http://localhost:8000/api/urls/check \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://reuters.com", "https://fake-scam.xyz"]}'
```

**Expected:** `results` array with `is_authentic`, `confidence`, `category`, `reason`.

### `GET /api/urls/`

```bash
curl http://localhost:8000/api/urls/
```

### `DELETE /api/urls/?url=https://example.com`

```bash
curl -X DELETE "http://localhost:8000/api/urls/?url=https://example.com"
```

---

## 16. Web Scraper + MongoDB

### `POST /api/scraper/scrape`

```bash
curl -X POST http://localhost:8000/api/scraper/scrape \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://investopedia.com"]}'
```

### `POST /api/scraper/scrape-csv?limit=3`

```bash
curl -X POST "http://localhost:8000/api/scraper/scrape-csv?limit=3"
```

### `GET /api/scraper/data`

```bash
curl http://localhost:8000/api/scraper/data
```

### `GET /api/scraper/data/search?q=invest&limit=5`

```bash
curl "http://localhost:8000/api/scraper/data/search?q=invest&limit=5"
```

### `GET /api/scraper/stats`

```bash
curl http://localhost:8000/api/scraper/stats
```

---

## 17. Full Auth Workflow

End-to-end workflow for testing the complete auth flow:

```bash
# 1. Signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Tester","email":"e2e@test.com","phone":"5555555555","password":"TestPass1!"}'

# 2. Retrieve OTP from DB (for automated testing)
python -c "
from pymongo import MongoClient
import os
from dotenv import load_dotenv
load_dotenv('backend/.env')
user = MongoClient(os.getenv('MONGO_URI'))['bidathon_db']['users'].find_one({'email':'e2e@test.com'})
print('OTP:', user['otp'])
"

# 3. Verify OTP (use the OTP from step 2)
curl -X POST http://localhost:8000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@test.com","otp":"THE_OTP"}'
# → Save the token from response

# 4. Access protected endpoint
TOKEN="THE_TOKEN_FROM_STEP_3"
curl http://localhost:8000/api/auth/profile -H "Authorization: Bearer $TOKEN"

# 5. Test agent (requires JWT)
curl -X POST http://localhost:8000/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the price of AAPL?"}'

# 6. Cleanup
curl -X DELETE http://localhost:8000/api/auth/account -H "Authorization: Bearer $TOKEN"
```

---

## Postman Tips

1. **Auto-import:** Open `http://localhost:8000/openapi.json`, save the JSON, then Postman → Import.
2. **Base URL variable:** Create `{{base}}` = `http://localhost:8000`.
3. **Auth token:** After login/verify-otp, save the token to an environment variable and set `Authorization: Bearer {{token}}` in collection-level headers.
4. **OTP retrieval:** Use the pre-request script or MongoDB Compass to retrieve OTP during development.

---

## 18. Quant Trading Terminal

### `GET /api/quant/strategies` — List All Strategies

**PowerShell:**
```powershell
Invoke-RestMethod http://localhost:8000/api/quant/strategies
```

**Expected:** Array of 20 strategy objects with `key`, `name`, `category`, `description`, `default_params`.

---

### `POST /api/quant/run` — Execute Strategy

**PowerShell:**
```powershell
$body = @{ ticker="AAPL"; strategy="ma_crossover"; period="6mo"; interval="1d"; params=@{ fast_period=10; slow_period=30 } } | ConvertTo-Json -Depth 3
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/quant/run -Body $body -ContentType "application/json"
```

**Expected:** `signals[]`, `metrics`, `indicator_data`.

### Strategies to Try

| Strategy | Key | Expected Output |
|----------|-----|-----------------|
| Moving Average Crossover | `ma_crossover` | BUY/SELL signals at SMA crossovers |
| RSI Strategy | `rsi_strategy` | Oversold BUY / Overbought SELL signals |
| Bollinger Reversion | `bollinger_reversion` | Band-touch mean reversion signals |
| MACD Signal | `macd_signal` | MACD/Signal line crossover signals |
| Kalman Filter | `kalman_filter` | Velocity zero-crossing signals |
| LSTM Proxy | `lstm_proxy` | ML composite threshold signals |
| ATR Breakout | `atr_breakout` | Volatility channel breakout signals |
| SuperTrend | `supertrend` | Trend-following signals with ATR bands |
| Stochastic | `stochastic` | %K/%D crossover in extreme zones |
| GBM Proxy | `gbm_proxy` | Multi-feature gradient boost signals |

---

### `POST /api/quant/backtest` — Backtest

**PowerShell:**
```powershell
$body = @{ ticker="MSFT"; strategy="rsi_strategy"; period="1y"; interval="1d" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/quant/backtest -Body $body -ContentType "application/json"
```

**Expected:** Same as `/run` + `equity_curve[]`.

---

### `POST /api/quant/ai-insight` — AI Analysis

```powershell
$body = @{ ticker="AAPL"; strategy="ma_crossover"; metrics=@{ sharpe_ratio=1.25; win_rate=0.62 } } | ConvertTo-Json -Depth 3
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/quant/ai-insight -Body $body -ContentType "application/json"
```

**Expected:** `{ "insight": "..." }` — AI-generated strategy analysis.

---

## 19. Quant SSE Streaming

### `GET /api/quant/stream/run` — SSE Strategy Execution

**Browser (JavaScript console):**
```javascript
const es = new EventSource("http://localhost:8000/api/quant/stream/run?ticker=AAPL&strategy=ma_crossover");
es.addEventListener("step", (e) => console.log("STEP:", JSON.parse(e.data)));
es.addEventListener("complete", (e) => { console.log("DONE:", JSON.parse(e.data)); es.close(); });
es.addEventListener("error", (e) => { console.error("ERR:", e.data); es.close(); });
```

**Expected step events:**
1. `"Loading Market Data"` (progress: 10)
2. `"Computing Fast SMA(10)"` (progress: 30, with indicator overlay)
3. `"Computing Slow SMA(30)"` (progress: 50, with indicator overlay)
4. `"Scanning Crossover Points"` (progress: 70, with signals)
5. `"Computing Risk Metrics"` (progress: 90)
6. `"Analysis Complete"` (progress: 100, `final: true`, full results)

**PowerShell (streamed):**
```powershell
Invoke-WebRequest "http://localhost:8000/api/quant/stream/run?ticker=AAPL&strategy=rsi_strategy" -Method Get | Select-Object -ExpandProperty Content
```

### Strategies to Test Streaming

All 20 strategies support streaming. 10 have custom step generators, 10 use the generic fallback:

| Custom Step Generator | Generic Fallback |
|----------------------|------------------|
| `ma_crossover` | `supertrend` |
| `ema_strategy` | `donchian_breakout` |
| `macd_signal` | `roc_strategy` |
| `rsi_strategy` | `cci_strategy` |
| `stochastic` | `zscore_reversion` |
| `bollinger_reversion` | `vwap_reversion` |
| `atr_breakout` | `keltner_channel` |
| `kalman_filter` | `volume_spike` |
| `lstm_proxy` | `order_imbalance` |
| `gbm_proxy` | `hmm_regime` |

---

## 20. Quant WebSocket Live Feed

### `WS /ws/quant/live/{ticker}` — Live Prices

**Browser (JavaScript console):**
```javascript
const ws = new WebSocket("ws://localhost:8000/ws/quant/live/AAPL");
ws.onmessage = (e) => console.log("PRICE:", JSON.parse(e.data));
ws.onopen = () => console.log("Connected");
ws.onclose = () => console.log("Disconnected");
```

**Expected:** Periodic `price_update` messages with `price`, `change`, `change_pct`, `volume`, `high`, `low`.

**Keepalive:**
```javascript
ws.send(JSON.stringify({ type: "ping" }));
```
