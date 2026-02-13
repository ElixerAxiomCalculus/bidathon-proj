# FinAlly - AI-Powered Financial Trading Dashboard

## Core Features

### 1. Smart Dashboard
- **Real-Time Market Ticker**: Live scrolling ticker with major indices (NIFTY 50, SENSEX) and live prices.
- **Portfolio Summary**: Instant view of total wallet balance and recent activity.
- **Market Status**: Visual indicator of agent status and market connectivity.

### 2. Intelligent Chat Interface
The heart of the application is the AI chat, featuring multilingual support (Type in Hindi, English, etc.) and four specialized modes:

- **Auto Mode**: Intelligently detects user intent (Trade, Chart, or Advice) from natural language.
- **Trader Mode**: Optimized for rapid execution. Handles orders like "Buy 10 TCS" with precision.
- **Charts Mode**: focused on Technical Analysis. Requests like "Show RELIANCE chart" trigger interactive visualizations.
- **Advisor Mode**: A deep-dive analytical engine that provides structured investment theses based on:
  - **Fundamental Health**: PE Ratio, Market Cap, Debt.
  - **Technical Momentum**: RSI, Moving Averages, Trend direction.
  - **Macro Catalysts**: Industry trends and global events.
  - **Bull/Bear Analysis**: Balanced scenarios for informed decision making.

### 3. Interactive Tools
- **Candlestick Charts**: Dynamic Zoom/Pan capable charts with OHLC data.
- **Trade Preview Cards**: Safe execution flow with Review -> Confirm/Cancel steps.
- **Thinking Process**: Transparent AI reasoning steps (visible in Advisor mode).

### 4. User System
- **Authentication**: Secure Login/Signup with Password + OTP 2FA verification.
- **Wallet System**: Add funds and track balance.
- **Profile Management**: Update user details and preferences.

## Technical Stack

- **Frontend**: React.js (Vite), React Router DOM.
- **Styling**: Vanilla CSS (Modular, Variable-based).
- **Charts**: Recharts / Lightweight Charts.
- **Backend**: FastAPI (Python), MongoDB.
- **AI Engine**: Hybrid (OpenAI GPT-4o-mini + Google Gemini 2.5 Flash).

## Documentation
A built-in **Documentation Page** is available within the app (accessible via Profile Dropdown) to guide users through all features.
