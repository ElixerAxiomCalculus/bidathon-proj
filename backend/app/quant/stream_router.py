"""
SSE streaming endpoint for real-time strategy execution visualization.

Streams step-by-step execution events to the frontend via Server-Sent Events.
Each event contains progress, partial indicators, partial signals, and step metadata.
"""

import asyncio
import json
import math
import traceback

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.services.yfinance.yf import get_stock_history
from app.quant.strategies import STRATEGY_REGISTRY
from app.quant.step_generators import get_step_generator, steps_generic

router = APIRouter(prefix="/quant", tags=["quant-stream"])

# Delay between steps — gives the frontend time to animate
STEP_DELAY = 0.45


def _clean_value(v):
    """Recursively clean a value for JSON serialization (NaN → None)."""
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    if isinstance(v, (np.ndarray,)):
        return [_clean_value(x) for x in v.tolist()]
    if isinstance(v, (pd.Timestamp,)):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _clean_value(val) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        return [_clean_value(x) for x in v]
    return v


def _safe_json(obj):
    """JSON-serialize with NaN/Inf safety."""
    cleaned = _clean_value(obj)
    return json.dumps(cleaned)


async def _stream_strategy(ticker: str, strategy: str, period: str, interval: str, params_json: str):
    """Generator that yields SSE events for strategy execution."""

    # Validate strategy exists
    if strategy not in STRATEGY_REGISTRY:
        yield f"event: error\ndata: {json.dumps({'error': f'Unknown strategy: {strategy}'})}\n\n"
        return

    entry = STRATEGY_REGISTRY[strategy]
    merged_params = {**entry["default_params"]}
    if params_json:
        try:
            merged_params.update(json.loads(params_json))
        except json.JSONDecodeError:
            pass

    # Fetch data
    try:
        history = get_stock_history(ticker, period=period, interval=interval)
        if not history:
            yield f"event: error\ndata: {json.dumps({'error': f'No data for {ticker}'})}\n\n"
            return
        df = pd.DataFrame(history)
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        return

    # Get step generator or fallback
    gen_fn = get_step_generator(strategy)
    if gen_fn:
        gen = gen_fn(df, merged_params)
    else:
        gen = steps_generic(df, merged_params, strategy, entry["fn"])

    # Stream steps with error handling
    try:
        for step_data in gen:
            event_type = "complete" if step_data.get("final") else "step"
            payload = _safe_json(step_data)
            yield f"event: {event_type}\ndata: {payload}\n\n"

            if not step_data.get("final"):
                await asyncio.sleep(STEP_DELAY)
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[STREAM ERROR] {strategy}: {e}\n{tb}")
        yield f"event: error\ndata: {json.dumps({'error': f'Strategy execution failed: {str(e)}'})}\n\n"


@router.get("/stream/run")
async def stream_strategy_execution(
    request: Request,
    ticker: str = Query(..., description="Stock ticker"),
    strategy: str = Query(..., description="Strategy key"),
    period: str = Query("6mo", description="Data period"),
    interval: str = Query("1d", description="Data interval"),
    params: str = Query("", description="JSON strategy params"),
):
    """SSE endpoint for streaming strategy execution."""

    async def event_generator():
        async for event in _stream_strategy(ticker, strategy, period, interval, params):
            # Check if client disconnected
            if await request.is_disconnected():
                return
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
