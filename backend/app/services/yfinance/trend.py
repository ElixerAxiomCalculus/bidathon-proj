"""
Trend Analyzer — SMA crossover direction + volatility scoring.

Takes OHLCV history data and returns trend direction, volatility, support/resistance.
"""

import statistics


def analyze_trend(history: list[dict]) -> dict:
    """
    Analyze trend from OHLCV history records.

    Returns:
        {
            "direction": "UPTREND" | "DOWNTREND" | "SIDEWAYS",
            "volatility_score": float (0-1),
            "price_change_pct": float,
            "avg_volume": int,
            "support": float,
            "resistance": float,
            "summary": str,
        }
    """
    if not history or len(history) < 2:
        return {
            "direction": "SIDEWAYS",
            "volatility_score": 0.0,
            "price_change_pct": 0.0,
            "avg_volume": 0,
            "support": 0.0,
            "resistance": 0.0,
            "summary": "Insufficient data for trend analysis.",
        }

    closes = [r["close"] for r in history]
    volumes = [r["volume"] for r in history]
    highs = [r["high"] for r in history]
    lows = [r["low"] for r in history]

    sma_short_period = min(10, len(closes))
    sma_long_period = min(30, len(closes))

    sma_short = statistics.mean(closes[-sma_short_period:])
    sma_long = statistics.mean(closes[-sma_long_period:])

    threshold = 0.005
    if sma_short > sma_long * (1 + threshold):
        direction = "UPTREND"
    elif sma_short < sma_long * (1 - threshold):
        direction = "DOWNTREND"
    else:
        direction = "SIDEWAYS"

    daily_returns = []
    for i in range(1, len(closes)):
        if closes[i - 1] != 0:
            daily_returns.append((closes[i] - closes[i - 1]) / closes[i - 1])

    if daily_returns:
        raw_vol = statistics.stdev(daily_returns) if len(daily_returns) > 1 else 0
        volatility_score = round(min(raw_vol / 0.05, 1.0), 2)
    else:
        volatility_score = 0.0

    first_close = closes[0]
    last_close = closes[-1]
    price_change_pct = round(
        ((last_close - first_close) / first_close) * 100, 2
    ) if first_close else 0.0

    support = round(min(lows), 2)
    resistance = round(max(highs), 2)

    avg_volume = int(statistics.mean(volumes)) if volumes else 0

    vol_label = "low" if volatility_score < 0.3 else ("moderate" if volatility_score < 0.6 else "high")
    summary = (
        f"The asset is in a {direction} (SMA-{sma_short_period} vs SMA-{sma_long_period}). "
        f"Price changed {price_change_pct:+.2f}% over the period. "
        f"Volatility is {vol_label} ({volatility_score}). "
        f"Support near ${support}, resistance near ${resistance}."
    )

    return {
        "direction": direction,
        "volatility_score": volatility_score,
        "price_change_pct": price_change_pct,
        "avg_volume": avg_volume,
        "support": support,
        "resistance": resistance,
        "summary": summary,
    }
