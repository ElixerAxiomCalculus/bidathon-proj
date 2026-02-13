"""
WebSocket endpoint for live price streaming.

Streams near-real-time price updates via server-pushed polling
over WebSocket. Uses yfinance data with 5-second refresh intervals.
"""

import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
import yfinance as yf


async def live_price_stream(websocket: WebSocket, ticker: str):
    """
    WebSocket handler: streams price updates for a given ticker.

    Sends JSON messages of the form:
    {
        "ticker": "AAPL",
        "price": 185.50,
        "open": 184.00,
        "high": 186.20,
        "low": 183.80,
        "volume": 51234000,
        "timestamp": "2026-02-13T10:30:00"
    }
    """
    await websocket.accept()

    try:
        while True:
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                price = info.get("currentPrice") or info.get("regularMarketPrice")

                if price is not None:
                    data = {
                        "ticker": ticker.upper(),
                        "price": float(price),
                        "open": float(info.get("open") or info.get("regularMarketOpen") or 0),
                        "high": float(info.get("dayHigh") or info.get("regularMarketDayHigh") or 0),
                        "low": float(info.get("dayLow") or info.get("regularMarketDayLow") or 0),
                        "volume": int(info.get("volume") or info.get("regularMarketVolume") or 0),
                        "previous_close": float(info.get("previousClose") or 0),
                        "change": round(float(price) - float(info.get("previousClose") or price), 2),
                        "change_pct": round(
                            (float(price) - float(info.get("previousClose") or price))
                            / float(info.get("previousClose") or price)
                            * 100, 2
                        ) if info.get("previousClose") else 0,
                    }
                    await websocket.send_text(json.dumps(data))

            except Exception:
                await websocket.send_text(json.dumps({
                    "error": f"Failed to fetch data for {ticker}",
                    "ticker": ticker.upper(),
                }))

            # Check for client messages (e.g., ticker change, close)
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                parsed = json.loads(msg)
                if parsed.get("action") == "change_ticker":
                    ticker = parsed.get("ticker", ticker)
                elif parsed.get("action") == "close":
                    break
            except asyncio.TimeoutError:
                pass

            await asyncio.sleep(5)

    except WebSocketDisconnect:
        pass
