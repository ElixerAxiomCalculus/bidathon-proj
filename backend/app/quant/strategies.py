"""
Quantitative Strategy Engine.

All strategies accept a pandas DataFrame with columns:
    date, open, high, low, close, volume
and return a dict with:
    signals: list of {date, type, price, label}
    metrics: dict of performance statistics
    indicator_data: dict of overlay/indicator series for chart rendering
"""

import numpy as np
import pandas as pd
from typing import Callable

# ─── Registry ───────────────────────────────────────────────

STRATEGY_REGISTRY: dict[str, dict] = {}


def register(key: str, name: str, category: str, description: str, default_params: dict | None = None):
    """Decorator to register a strategy function."""
    def decorator(fn: Callable):
        STRATEGY_REGISTRY[key] = {
            "key": key,
            "name": name,
            "category": category,
            "description": description,
            "default_params": default_params or {},
            "fn": fn,
        }
        return fn
    return decorator


def list_strategies() -> list[dict]:
    return [
        {k: v for k, v in info.items() if k != "fn"}
        for info in STRATEGY_REGISTRY.values()
    ]


def run_strategy(key: str, df: pd.DataFrame, params: dict | None = None) -> dict:
    if key not in STRATEGY_REGISTRY:
        raise ValueError(f"Unknown strategy: {key}")
    entry = STRATEGY_REGISTRY[key]
    merged = {**entry["default_params"], **(params or {})}
    return entry["fn"](df, merged)


# ─── Helpers ────────────────────────────────────────────────

def _compute_metrics(df: pd.DataFrame, signals: list[dict]) -> dict:
    """Compute standard performance metrics from signal list."""
    buys = [s for s in signals if s["type"] == "BUY"]
    sells = [s for s in signals if s["type"] == "SELL"]

    trades = []
    for i in range(min(len(buys), len(sells))):
        pnl = sells[i]["price"] - buys[i]["price"]
        trades.append(pnl)

    if not trades:
        return {
            "sharpe_ratio": 0.0, "max_drawdown": 0.0, "win_rate": 0.0,
            "total_trades": 0, "profit_factor": 0.0, "avg_win": 0.0,
            "avg_loss": 0.0, "risk_level": "LOW", "confidence": 0.0,
            "verdict": "Insufficient signals for analysis",
            "suggested_position_pct": 0.0,
        }

    wins = [t for t in trades if t > 0]
    losses = [t for t in trades if t <= 0]
    win_rate = len(wins) / len(trades) if trades else 0
    avg_win = np.mean(wins) if wins else 0
    avg_loss = abs(np.mean(losses)) if losses else 0
    profit_factor = (sum(wins) / abs(sum(losses))) if losses and sum(losses) != 0 else float("inf") if wins else 0

    returns = np.array(trades) / df["close"].iloc[0] if df["close"].iloc[0] else np.array(trades)
    sharpe = (np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) > 0 else 0

    cumulative = np.cumsum(trades)
    peak = np.maximum.accumulate(cumulative)
    drawdowns = (peak - cumulative)
    max_dd = float(np.max(drawdowns)) if len(drawdowns) > 0 else 0
    max_dd_pct = (max_dd / df["close"].iloc[0] * 100) if df["close"].iloc[0] else 0

    if sharpe > 1.5 and win_rate > 0.6:
        risk_level, confidence = "LOW", min(0.85, win_rate)
    elif sharpe > 0.5:
        risk_level, confidence = "MODERATE", min(0.7, win_rate)
    else:
        risk_level, confidence = "HIGH", min(0.5, win_rate)

    net_pnl = sum(trades)
    verdict = (
        f"{'Bullish' if net_pnl > 0 else 'Bearish'} bias detected. "
        f"{len(trades)} round-trip trades with {win_rate*100:.0f}% win rate. "
        f"Risk-adjusted return {'favorable' if sharpe > 1 else 'marginal' if sharpe > 0 else 'unfavorable'}."
    )

    position_pct = max(2, min(25, int(win_rate * 30)))

    return {
        "sharpe_ratio": round(float(sharpe), 3),
        "max_drawdown": round(max_dd_pct, 2),
        "win_rate": round(win_rate, 3),
        "total_trades": len(trades),
        "profit_factor": round(float(profit_factor), 3) if profit_factor != float("inf") else 999.0,
        "avg_win": round(float(avg_win), 2),
        "avg_loss": round(float(avg_loss), 2),
        "risk_level": risk_level,
        "confidence": round(float(confidence), 3),
        "verdict": verdict,
        "suggested_position_pct": float(position_pct),
    }


def _sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period, min_periods=1).mean()


def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift(1)).abs()
    low_close = (df["low"] - df["close"].shift(1)).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return tr.rolling(window=period, min_periods=1).mean()


def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period, min_periods=1).mean()
    avg_loss = loss.rolling(window=period, min_periods=1).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _bollinger(series: pd.Series, period: int = 20, std_dev: float = 2.0):
    mid = _sma(series, period)
    std = series.rolling(window=period, min_periods=1).std()
    return mid, mid + std_dev * std, mid - std_dev * std


def _dates(df: pd.DataFrame) -> list[str]:
    return df["date"].astype(str).tolist()


# ═══════════════════════════════════════════════════════════
# TREND FOLLOWING
# ═══════════════════════════════════════════════════════════

@register("ma_crossover", "Moving Average Crossover", "Trend Following",
          "Generates signals when fast SMA crosses above/below slow SMA.",
          {"fast_period": 10, "slow_period": 30})
def ma_crossover(df: pd.DataFrame, params: dict) -> dict:
    fast = _sma(df["close"], params["fast_period"])
    slow = _sma(df["close"], params["slow_period"])

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if fast.iloc[i] > slow.iloc[i] and fast.iloc[i-1] <= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif fast.iloc[i] < slow.iloc[i] and fast.iloc[i-1] >= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "fast_sma": fast.round(2).tolist(),
            "slow_sma": slow.round(2).tolist(),
        },
    }


@register("ema_strategy", "EMA Strategy", "Trend Following",
          "Exponential MA crossover with faster response to price changes.",
          {"fast_period": 9, "slow_period": 21})
def ema_strategy(df: pd.DataFrame, params: dict) -> dict:
    fast = _ema(df["close"], params["fast_period"])
    slow = _ema(df["close"], params["slow_period"])

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if fast.iloc[i] > slow.iloc[i] and fast.iloc[i-1] <= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif fast.iloc[i] < slow.iloc[i] and fast.iloc[i-1] >= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "fast_ema": fast.round(2).tolist(),
            "slow_ema": slow.round(2).tolist(),
        },
    }


@register("macd_signal", "MACD Signal", "Trend Following",
          "MACD line vs signal line crossover strategy.",
          {"fast": 12, "slow": 26, "signal": 9})
def macd_signal(df: pd.DataFrame, params: dict) -> dict:
    fast_ema = _ema(df["close"], params["fast"])
    slow_ema = _ema(df["close"], params["slow"])
    macd_line = fast_ema - slow_ema
    signal_line = _ema(macd_line, params["signal"])
    histogram = macd_line - signal_line

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if macd_line.iloc[i] > signal_line.iloc[i] and macd_line.iloc[i-1] <= signal_line.iloc[i-1]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif macd_line.iloc[i] < signal_line.iloc[i] and macd_line.iloc[i-1] >= signal_line.iloc[i-1]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "macd": macd_line.round(4).tolist(),
            "signal": signal_line.round(4).tolist(),
            "histogram": histogram.round(4).tolist(),
        },
    }


@register("supertrend", "Supertrend", "Trend Following",
          "ATR-based trend following indicator.",
          {"period": 10, "multiplier": 3.0})
def supertrend(df: pd.DataFrame, params: dict) -> dict:
    atr = _atr(df, params["period"])
    hl2 = (df["high"] + df["low"]) / 2
    upper_band = hl2 + params["multiplier"] * atr
    lower_band = hl2 - params["multiplier"] * atr

    supertrend_vals = pd.Series(np.nan, index=df.index)
    direction = pd.Series(1, index=df.index)

    for i in range(1, len(df)):
        if df["close"].iloc[i] > upper_band.iloc[i-1]:
            direction.iloc[i] = 1
        elif df["close"].iloc[i] < lower_band.iloc[i-1]:
            direction.iloc[i] = -1
        else:
            direction.iloc[i] = direction.iloc[i-1]

        supertrend_vals.iloc[i] = lower_band.iloc[i] if direction.iloc[i] == 1 else upper_band.iloc[i]

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if direction.iloc[i] == 1 and direction.iloc[i-1] == -1:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif direction.iloc[i] == -1 and direction.iloc[i-1] == 1:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "supertrend": supertrend_vals.round(2).tolist(),
            "direction": direction.tolist(),
        },
    }


@register("donchian_breakout", "Donchian Channel Breakout", "Trend Following",
          "Breakout signals when price breaches Donchian channel highs/lows.",
          {"period": 20})
def donchian_breakout(df: pd.DataFrame, params: dict) -> dict:
    period = params["period"]
    upper = df["high"].rolling(window=period, min_periods=1).max()
    lower = df["low"].rolling(window=period, min_periods=1).min()
    middle = (upper + lower) / 2

    signals = []
    dates = _dates(df)
    position = 0
    for i in range(period, len(df)):
        if df["close"].iloc[i] > upper.iloc[i-1] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif df["close"].iloc[i] < lower.iloc[i-1] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "upper": upper.round(2).tolist(),
            "lower": lower.round(2).tolist(),
            "middle": middle.round(2).tolist(),
        },
    }


# ═══════════════════════════════════════════════════════════
# MOMENTUM
# ═══════════════════════════════════════════════════════════

@register("rsi_strategy", "RSI Strategy", "Momentum",
          "Buys on RSI oversold, sells on RSI overbought.",
          {"period": 14, "oversold": 30, "overbought": 70})
def rsi_strategy(df: pd.DataFrame, params: dict) -> dict:
    rsi = _rsi(df["close"], params["period"])

    signals = []
    dates = _dates(df)
    position = 0
    for i in range(params["period"], len(df)):
        if rsi.iloc[i] < params["oversold"] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif rsi.iloc[i] > params["overbought"] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"rsi": rsi.round(2).tolist()},
    }


@register("stochastic", "Stochastic Oscillator", "Momentum",
          "K/D crossover on stochastic oscillator.",
          {"k_period": 14, "d_period": 3, "oversold": 20, "overbought": 80})
def stochastic(df: pd.DataFrame, params: dict) -> dict:
    low_min = df["low"].rolling(window=params["k_period"], min_periods=1).min()
    high_max = df["high"].rolling(window=params["k_period"], min_periods=1).max()
    denom = high_max - low_min
    k = 100 * (df["close"] - low_min) / denom.replace(0, np.nan)
    k = k.fillna(50)
    d = _sma(k, params["d_period"])

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if k.iloc[i] > d.iloc[i] and k.iloc[i-1] <= d.iloc[i-1] and k.iloc[i] < params["oversold"] + 10:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif k.iloc[i] < d.iloc[i] and k.iloc[i-1] >= d.iloc[i-1] and k.iloc[i] > params["overbought"] - 10:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"stoch_k": k.round(2).tolist(), "stoch_d": d.round(2).tolist()},
    }


@register("roc", "Rate of Change", "Momentum",
          "Momentum signal based on N-period rate of change.",
          {"period": 12, "threshold": 0})
def roc_strategy(df: pd.DataFrame, params: dict) -> dict:
    period = params["period"]
    roc = ((df["close"] - df["close"].shift(period)) / df["close"].shift(period) * 100).fillna(0)

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if roc.iloc[i] > params["threshold"] and roc.iloc[i-1] <= params["threshold"]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif roc.iloc[i] < params["threshold"] and roc.iloc[i-1] >= params["threshold"]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"roc": roc.round(4).tolist()},
    }


@register("cci", "Commodity Channel Index", "Momentum",
          "CCI-based overbought/oversold signals.",
          {"period": 20, "overbought": 100, "oversold": -100})
def cci_strategy(df: pd.DataFrame, params: dict) -> dict:
    tp = (df["high"] + df["low"] + df["close"]) / 3
    sma_tp = _sma(tp, params["period"])
    mad = tp.rolling(window=params["period"], min_periods=1).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)
    cci = (tp - sma_tp) / (0.015 * mad.replace(0, np.nan))
    cci = cci.fillna(0)

    signals = []
    dates = _dates(df)
    position = 0
    for i in range(params["period"], len(df)):
        if cci.iloc[i] < params["oversold"] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif cci.iloc[i] > params["overbought"] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"cci": cci.round(2).tolist()},
    }


# ═══════════════════════════════════════════════════════════
# MEAN REVERSION
# ═══════════════════════════════════════════════════════════

@register("bollinger_reversion", "Bollinger Bands Reversion", "Mean Reversion",
          "Mean reversion using Bollinger Band touches.",
          {"period": 20, "std_dev": 2.0})
def bollinger_reversion(df: pd.DataFrame, params: dict) -> dict:
    mid, upper, lower = _bollinger(df["close"], params["period"], params["std_dev"])

    signals = []
    dates = _dates(df)
    position = 0
    for i in range(params["period"], len(df)):
        if df["close"].iloc[i] <= lower.iloc[i] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif df["close"].iloc[i] >= upper.iloc[i] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "bb_upper": upper.round(2).tolist(),
            "bb_middle": mid.round(2).tolist(),
            "bb_lower": lower.round(2).tolist(),
        },
    }


@register("zscore_reversion", "Z-Score Reversion", "Mean Reversion",
          "Z-score of price relative to rolling mean for mean reversion.",
          {"period": 20, "entry_z": -2.0, "exit_z": 0.0})
def zscore_reversion(df: pd.DataFrame, params: dict) -> dict:
    period = params["period"]
    mean = _sma(df["close"], period)
    std = df["close"].rolling(window=period, min_periods=1).std()
    zscore = (df["close"] - mean) / std.replace(0, np.nan)
    zscore = zscore.fillna(0)

    signals = []
    dates = _dates(df)
    position = 0
    for i in range(period, len(df)):
        if zscore.iloc[i] <= params["entry_z"] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif zscore.iloc[i] >= -params["entry_z"] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1
        elif position != 0 and abs(zscore.iloc[i]) <= abs(params["exit_z"]):
            sig_type = "SELL" if position == 1 else "BUY"
            signals.append({"date": dates[i], "type": sig_type, "price": float(df["close"].iloc[i])})
            position = 0

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"zscore": zscore.round(4).tolist()},
    }


@register("vwap_reversion", "VWAP Reversion", "Mean Reversion",
          "Reversion towards Volume-Weighted Average Price.",
          {"deviation_pct": 2.0})
def vwap_reversion(df: pd.DataFrame, params: dict) -> dict:
    cum_vol = df["volume"].cumsum()
    cum_tp_vol = ((df["high"] + df["low"] + df["close"]) / 3 * df["volume"]).cumsum()
    vwap = cum_tp_vol / cum_vol.replace(0, np.nan)
    vwap = vwap.fillna(df["close"])

    dev = params["deviation_pct"] / 100
    signals = []
    dates = _dates(df)
    position = 0
    for i in range(20, len(df)):
        if df["close"].iloc[i] < vwap.iloc[i] * (1 - dev) and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif df["close"].iloc[i] > vwap.iloc[i] * (1 + dev) and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"vwap": vwap.round(2).tolist()},
    }


# ═══════════════════════════════════════════════════════════
# VOLATILITY
# ═══════════════════════════════════════════════════════════

@register("atr_breakout", "ATR Breakout", "Volatility",
          "Breakout signals based on ATR expansion from recent closes.",
          {"period": 14, "multiplier": 1.5})
def atr_breakout(df: pd.DataFrame, params: dict) -> dict:
    atr = _atr(df, params["period"])
    sma = _sma(df["close"], params["period"])
    upper = sma + params["multiplier"] * atr
    lower = sma - params["multiplier"] * atr

    signals = []
    dates = _dates(df)
    position = 0
    for i in range(params["period"], len(df)):
        if df["close"].iloc[i] > upper.iloc[i] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif df["close"].iloc[i] < lower.iloc[i] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"atr": atr.round(2).tolist(), "atr_upper": upper.round(2).tolist(), "atr_lower": lower.round(2).tolist()},
    }


@register("keltner_channel", "Keltner Channel", "Volatility",
          "EMA-based channel with ATR bands; signals on breakout and reversion.",
          {"ema_period": 20, "atr_period": 14, "multiplier": 2.0})
def keltner_channel(df: pd.DataFrame, params: dict) -> dict:
    ema = _ema(df["close"], params["ema_period"])
    atr = _atr(df, params["atr_period"])
    upper = ema + params["multiplier"] * atr
    lower = ema - params["multiplier"] * atr

    signals = []
    dates = _dates(df)
    position = 0
    for i in range(max(params["ema_period"], params["atr_period"]), len(df)):
        if df["close"].iloc[i] > upper.iloc[i] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif df["close"].iloc[i] < lower.iloc[i] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "keltner_ema": ema.round(2).tolist(),
            "keltner_upper": upper.round(2).tolist(),
            "keltner_lower": lower.round(2).tolist(),
        },
    }


# ═══════════════════════════════════════════════════════════
# MARKET MICROSTRUCTURE
# ═══════════════════════════════════════════════════════════

@register("volume_spike", "Volume Spike Detection", "Market Microstructure",
          "Detects abnormal volume spikes that often precede price moves.",
          {"lookback": 20, "threshold": 2.0})
def volume_spike(df: pd.DataFrame, params: dict) -> dict:
    vol_sma = _sma(df["volume"].astype(float), params["lookback"])
    vol_ratio = df["volume"] / vol_sma.replace(0, np.nan)
    vol_ratio = vol_ratio.fillna(1)

    signals = []
    dates = _dates(df)
    for i in range(params["lookback"], len(df)):
        if vol_ratio.iloc[i] > params["threshold"]:
            price_change = df["close"].iloc[i] - df["close"].iloc[i-1]
            sig_type = "BUY" if price_change > 0 else "SELL"
            signals.append({
                "date": dates[i], "type": sig_type, "price": float(df["close"].iloc[i]),
                "label": f"Volume {vol_ratio.iloc[i]:.1f}x avg",
            })

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"volume_ratio": vol_ratio.round(2).tolist()},
    }


@register("order_imbalance", "Order Imbalance Detection", "Market Microstructure",
          "Detects buy/sell pressure imbalance from OHLC price action.",
          {"lookback": 10, "threshold": 0.6})
def order_imbalance(df: pd.DataFrame, params: dict) -> dict:
    buying_pressure = df["close"] - df["low"]
    selling_pressure = df["high"] - df["close"]
    total_range = (df["high"] - df["low"]).replace(0, np.nan)
    imbalance = (buying_pressure - selling_pressure) / total_range
    imbalance = imbalance.fillna(0)
    smoothed = _sma(imbalance, params["lookback"])

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if smoothed.iloc[i] > params["threshold"] and smoothed.iloc[i-1] <= params["threshold"]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif smoothed.iloc[i] < -params["threshold"] and smoothed.iloc[i-1] >= -params["threshold"]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"imbalance": smoothed.round(4).tolist()},
    }


# ═══════════════════════════════════════════════════════════
# STATISTICAL / QUANT
# ═══════════════════════════════════════════════════════════

@register("kalman_filter", "Kalman Filter Trend", "Statistical",
          "Kalman filter for adaptive trend estimation and signal generation.",
          {"process_noise": 0.01, "measurement_noise": 1.0})
def kalman_filter(df: pd.DataFrame, params: dict) -> dict:
    closes = df["close"].values.astype(float)
    n = len(closes)

    x = closes[0]
    p = 1.0
    q = params["process_noise"]
    r = params["measurement_noise"]
    filtered = np.zeros(n)
    velocity = np.zeros(n)

    for i in range(n):
        p_pred = p + q
        k = p_pred / (p_pred + r)
        prev_x = x
        x = x + k * (closes[i] - x)
        p = (1 - k) * p_pred
        filtered[i] = x
        velocity[i] = x - prev_x

    signals = []
    dates = _dates(df)
    for i in range(1, n):
        if velocity[i] > 0 and velocity[i-1] <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(closes[i])})
        elif velocity[i] < 0 and velocity[i-1] >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(closes[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {
            "kalman": np.round(filtered, 2).tolist(),
            "kalman_velocity": np.round(velocity, 6).tolist(),
        },
    }


@register("hmm_regime", "Hidden Markov Regime Detection", "Statistical",
          "Regime detection using return distribution clustering (simplified HMM).",
          {"lookback": 30, "n_regimes": 3})
def hmm_regime(df: pd.DataFrame, params: dict) -> dict:
    returns = df["close"].pct_change().fillna(0)
    vol = returns.rolling(window=params["lookback"], min_periods=1).std()
    mean_ret = returns.rolling(window=params["lookback"], min_periods=1).mean()

    vol_thresh_low = vol.quantile(0.33)
    vol_thresh_high = vol.quantile(0.66)

    regime = pd.Series(0, index=df.index)
    for i in range(len(df)):
        if vol.iloc[i] < vol_thresh_low:
            regime.iloc[i] = 0  # Low volatility
        elif vol.iloc[i] > vol_thresh_high:
            regime.iloc[i] = 2  # High volatility
        else:
            regime.iloc[i] = 1  # Medium

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if regime.iloc[i] != regime.iloc[i-1]:
            if regime.iloc[i] == 0 and mean_ret.iloc[i] > 0:
                signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i]),
                                "label": "Low-vol bullish regime"})
            elif regime.iloc[i] == 2:
                signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i]),
                                "label": "High-vol regime shift"})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"regime": regime.tolist(), "rolling_vol": vol.round(6).tolist()},
    }


# ═══════════════════════════════════════════════════════════
# ML-PROXY STRATEGIES
# ═══════════════════════════════════════════════════════════

@register("lstm_proxy", "LSTM Forecast (Proxy)", "Machine Learning",
          "Multi-indicator ensemble simulating LSTM-style sequential pattern recognition.",
          {"lookback": 30})
def lstm_proxy(df: pd.DataFrame, params: dict) -> dict:
    lb = params["lookback"]
    rsi = _rsi(df["close"], 14)
    macd_fast = _ema(df["close"], 12)
    macd_slow = _ema(df["close"], 26)
    macd = macd_fast - macd_slow
    bb_mid, bb_upper, bb_lower = _bollinger(df["close"], 20, 2)
    bb_pct = (df["close"] - bb_lower) / (bb_upper - bb_lower).replace(0, np.nan)
    bb_pct = bb_pct.fillna(0.5)

    composite = (
        (rsi / 100 - 0.5) * 0.3 +
        (macd / df["close"].replace(0, np.nan)).fillna(0) * 0.4 +
        (bb_pct - 0.5) * 0.3
    )
    smoothed = _ema(composite, lb)

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if smoothed.iloc[i] > 0.05 and smoothed.iloc[i-1] <= 0.05:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif smoothed.iloc[i] < -0.05 and smoothed.iloc[i-1] >= -0.05:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"ml_composite": smoothed.round(6).tolist()},
    }


@register("gbm_proxy", "Gradient Boosting (Proxy)", "Machine Learning",
          "Feature-engineered ensemble simulating gradient boosting classification.",
          {"lookback": 20})
def gbm_proxy(df: pd.DataFrame, params: dict) -> dict:
    lb = params["lookback"]
    rsi = _rsi(df["close"], 14)
    atr = _atr(df, 14)
    vol_sma = _sma(df["volume"].astype(float), lb)
    vol_ratio = (df["volume"] / vol_sma.replace(0, np.nan)).fillna(1)

    momentum = df["close"].pct_change(lb).fillna(0)
    mean_rev = (df["close"] / _sma(df["close"], lb) - 1).fillna(0)

    score = (
        (rsi / 100 - 0.5) * 0.2 +
        momentum.clip(-0.1, 0.1) * 2 +
        -mean_rev.clip(-0.05, 0.05) * 3 +
        (vol_ratio - 1).clip(-1, 1) * 0.1
    )
    smoothed = _ema(score, 5)

    signals = []
    dates = _dates(df)
    for i in range(1, len(df)):
        if smoothed.iloc[i] > 0.03 and smoothed.iloc[i-1] <= 0.03:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif smoothed.iloc[i] < -0.03 and smoothed.iloc[i-1] >= -0.03:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    return {
        "signals": signals,
        "metrics": _compute_metrics(df, signals),
        "indicator_data": {"gbm_score": smoothed.round(6).tolist()},
    }
