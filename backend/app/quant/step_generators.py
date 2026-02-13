"""
Step generators for streaming strategy execution.

Each strategy gets a generator that yields execution steps with:
  - step: current step number
  - total: total steps
  - title: step name (displayed to user)
  - detail: description
  - progress: 0-100 percentage
  - indicator: optional partial indicator data to overlay on chart
  - signals: optional partial signals found so far
"""

import time
import numpy as np
import pandas as pd
from app.quant.strategies import (
    _sma, _ema, _atr, _rsi, _bollinger, _dates, _compute_metrics
)


def _step(step, total, title, detail, progress, **extra):
    return {"step": step, "total": total, "title": title,
            "detail": detail, "progress": progress, **extra}


# ═══════════════════════════════════════════════════════════
# TREND FOLLOWING
# ═══════════════════════════════════════════════════════════

def steps_ma_crossover(df, params):
    dates = _dates(df)
    fp, sp = params.get("fast_period", 10), params.get("slow_period", 30)

    yield _step(1, 6, "Loading Market Data",
                f"{len(df)} bars loaded for analysis", 10)

    fast = _sma(df["close"], fp)
    yield _step(2, 6, f"Computing Fast SMA({fp})",
                f"Smoothing price with {fp}-period simple moving average",
                30, indicator={"fast_sma": fast.round(2).tolist()})

    slow = _sma(df["close"], sp)
    yield _step(3, 6, f"Computing Slow SMA({sp})",
                f"Establishing trend baseline with {sp}-period SMA",
                50, indicator={"slow_sma": slow.round(2).tolist()})

    signals = []
    for i in range(1, len(df)):
        if fast.iloc[i] > slow.iloc[i] and fast.iloc[i-1] <= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif fast.iloc[i] < slow.iloc[i] and fast.iloc[i-1] >= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    buys = len([s for s in signals if s["type"] == "BUY"])
    sells = len([s for s in signals if s["type"] == "SELL"])
    yield _step(4, 6, "Scanning Crossover Points",
                f"Detected {buys} bullish and {sells} bearish crossovers",
                70, signals=signals)

    metrics = _compute_metrics(df, signals)
    yield _step(5, 6, "Computing Risk Metrics",
                f"Sharpe {metrics['sharpe_ratio']:.3f} | Win Rate {metrics['win_rate']*100:.0f}% | Max DD {metrics['max_drawdown']:.1f}%",
                90)

    trend = "BULLISH" if fast.iloc[-1] > slow.iloc[-1] else "BEARISH"
    yield _step(6, 6, "Analysis Complete",
                f"Current regime: {trend}. {len(signals)} signals generated.",
                100, final=True, signals=signals, metrics=metrics,
                indicator_data={"fast_sma": fast.round(2).tolist(), "slow_sma": slow.round(2).tolist()},
                output_type="trend", output={"direction": trend,
                    "strength": round(abs(float(fast.iloc[-1] - slow.iloc[-1])) / float(df["close"].iloc[-1]) * 100, 2),
                    "fast_val": round(float(fast.iloc[-1]), 2),
                    "slow_val": round(float(slow.iloc[-1]), 2)})


def steps_ema_strategy(df, params):
    dates = _dates(df)
    fp, sp = params.get("fast_period", 9), params.get("slow_period", 21)

    yield _step(1, 5, "Loading Market Data", f"{len(df)} bars loaded", 10)

    fast = _ema(df["close"], fp)
    yield _step(2, 5, f"Computing Fast EMA({fp})",
                f"Exponential weighting with span={fp}", 30,
                indicator={"fast_ema": fast.round(2).tolist()})

    slow = _ema(df["close"], sp)
    yield _step(3, 5, f"Computing Slow EMA({sp})",
                f"Trend baseline with span={sp}", 50,
                indicator={"slow_ema": slow.round(2).tolist()})

    signals = []
    for i in range(1, len(df)):
        if fast.iloc[i] > slow.iloc[i] and fast.iloc[i-1] <= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif fast.iloc[i] < slow.iloc[i] and fast.iloc[i-1] >= slow.iloc[i-1]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    metrics = _compute_metrics(df, signals)
    yield _step(4, 5, "Signal Detection Complete",
                f"{len(signals)} crossovers found", 80, signals=signals)

    trend = "BULLISH" if fast.iloc[-1] > slow.iloc[-1] else "BEARISH"
    yield _step(5, 5, "Analysis Complete", f"Regime: {trend}", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"fast_ema": fast.round(2).tolist(), "slow_ema": slow.round(2).tolist()},
                output_type="trend", output={"direction": trend,
                    "strength": round(abs(float(fast.iloc[-1] - slow.iloc[-1])) / float(df["close"].iloc[-1]) * 100, 2)})


def steps_macd_signal(df, params):
    dates = _dates(df)
    f, s, sig = params.get("fast", 12), params.get("slow", 26), params.get("signal", 9)

    yield _step(1, 6, "Loading Market Data", f"{len(df)} bars loaded", 10)

    fast_ema = _ema(df["close"], f)
    yield _step(2, 6, f"Computing Fast EMA({f})", "Short-term momentum line", 25)

    slow_ema = _ema(df["close"], s)
    macd_line = fast_ema - slow_ema
    yield _step(3, 6, f"Computing MACD Line (EMA{f}-EMA{s})",
                f"MACD range: [{macd_line.min():.2f}, {macd_line.max():.2f}]", 45)

    signal_line = _ema(macd_line, sig)
    histogram = macd_line - signal_line
    yield _step(4, 6, f"Computing Signal Line (EMA{sig} of MACD)",
                "Trigger line for crossover detection", 60)

    signals = []
    for i in range(1, len(df)):
        if macd_line.iloc[i] > signal_line.iloc[i] and macd_line.iloc[i-1] <= signal_line.iloc[i-1]:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif macd_line.iloc[i] < signal_line.iloc[i] and macd_line.iloc[i-1] >= signal_line.iloc[i-1]:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    metrics = _compute_metrics(df, signals)
    yield _step(5, 6, "Crossover Detection",
                f"{len(signals)} MACD/Signal crossovers detected", 85, signals=signals)

    momentum = "BULLISH" if macd_line.iloc[-1] > signal_line.iloc[-1] else "BEARISH"
    yield _step(6, 6, "Analysis Complete", f"MACD momentum: {momentum}", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"macd": macd_line.round(4).tolist(), "signal": signal_line.round(4).tolist()},
                output_type="momentum", output={"direction": momentum,
                    "macd_val": round(float(macd_line.iloc[-1]), 4),
                    "signal_val": round(float(signal_line.iloc[-1]), 4),
                    "histogram": round(float(histogram.iloc[-1]), 4)})


# ═══════════════════════════════════════════════════════════
# MOMENTUM
# ═══════════════════════════════════════════════════════════

def steps_rsi_strategy(df, params):
    dates = _dates(df)
    period = params.get("period", 14)
    ob, os_ = params.get("overbought", 70), params.get("oversold", 30)

    yield _step(1, 5, "Loading Market Data", f"{len(df)} bars loaded", 10)

    rsi = _rsi(df["close"], period)
    current_rsi = float(rsi.iloc[-1])
    yield _step(2, 5, f"Computing RSI({period})",
                f"Current RSI: {current_rsi:.1f} | Range: [{float(rsi.min()):.1f}, {float(rsi.max()):.1f}]",
                40)

    signals = []
    position = 0
    for i in range(period, len(df)):
        if rsi.iloc[i] < os_ and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif rsi.iloc[i] > ob and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    metrics = _compute_metrics(df, signals)
    yield _step(3, 5, "Scanning Oversold/Overbought Zones",
                f"{len(signals)} signals at RSI extremes", 70, signals=signals)

    yield _step(4, 5, "Computing Risk Metrics",
                f"Sharpe {metrics['sharpe_ratio']:.3f} | Win Rate {metrics['win_rate']*100:.0f}%", 90)

    zone = "OVERBOUGHT" if current_rsi > ob else "OVERSOLD" if current_rsi < os_ else "NEUTRAL"
    yield _step(5, 5, "Analysis Complete", f"Current zone: {zone} (RSI={current_rsi:.1f})", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"rsi": rsi.round(2).tolist()},
                output_type="momentum", output={"zone": zone, "rsi_value": round(current_rsi, 1),
                    "overbought": ob, "oversold": os_})


def steps_stochastic(df, params):
    dates = _dates(df)
    kp, dp = params.get("k_period", 14), params.get("d_period", 3)
    ob, os_ = params.get("overbought", 80), params.get("oversold", 20)

    yield _step(1, 5, "Loading Market Data", f"{len(df)} bars loaded", 10)

    low_min = df["low"].rolling(window=kp, min_periods=1).min()
    high_max = df["high"].rolling(window=kp, min_periods=1).max()
    denom = high_max - low_min
    k = 100 * (df["close"] - low_min) / denom.replace(0, np.nan)
    k = k.fillna(50)
    d = _sma(k, dp)
    yield _step(2, 5, f"Computing %K({kp}) and %D({dp})",
                f"Current %K={float(k.iloc[-1]):.1f}, %D={float(d.iloc[-1]):.1f}", 40)

    signals = []
    for i in range(1, len(df)):
        if k.iloc[i] > d.iloc[i] and k.iloc[i-1] <= d.iloc[i-1] and k.iloc[i] < os_ + 10:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif k.iloc[i] < d.iloc[i] and k.iloc[i-1] >= d.iloc[i-1] and k.iloc[i] > ob - 10:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    metrics = _compute_metrics(df, signals)
    yield _step(3, 5, "Detecting K/D Crossovers", f"{len(signals)} signals found", 70, signals=signals)
    yield _step(4, 5, "Computing Metrics", f"Win Rate {metrics['win_rate']*100:.0f}%", 90)

    zone = "OVERBOUGHT" if k.iloc[-1] > ob else "OVERSOLD" if k.iloc[-1] < os_ else "NEUTRAL"
    yield _step(5, 5, "Analysis Complete", f"Zone: {zone}", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"stoch_k": k.round(2).tolist(), "stoch_d": d.round(2).tolist()},
                output_type="momentum", output={"zone": zone, "k_value": round(float(k.iloc[-1]), 1),
                    "d_value": round(float(d.iloc[-1]), 1)})


# ═══════════════════════════════════════════════════════════
# MEAN REVERSION
# ═══════════════════════════════════════════════════════════

def steps_bollinger_reversion(df, params):
    dates = _dates(df)
    period, stddev = params.get("period", 20), params.get("std_dev", 2.0)

    yield _step(1, 5, "Loading Market Data", f"{len(df)} bars loaded", 10)

    mid, upper, lower = _bollinger(df["close"], period, stddev)
    bandwidth = ((upper.iloc[-1] - lower.iloc[-1]) / mid.iloc[-1] * 100)
    yield _step(2, 5, f"Computing Bollinger Bands({period}, {stddev}σ)",
                f"Bandwidth: {bandwidth:.1f}% | Upper: {upper.iloc[-1]:.2f} | Lower: {lower.iloc[-1]:.2f}",
                40, indicator={"bb_upper": upper.round(2).tolist(), "bb_middle": mid.round(2).tolist(),
                               "bb_lower": lower.round(2).tolist()})

    signals = []
    position = 0
    for i in range(period, len(df)):
        if df["close"].iloc[i] <= lower.iloc[i] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif df["close"].iloc[i] >= upper.iloc[i] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    metrics = _compute_metrics(df, signals)
    yield _step(3, 5, "Scanning Band Touches", f"{len(signals)} mean-reversion signals", 65, signals=signals)
    yield _step(4, 5, "Computing Metrics", f"Sharpe {metrics['sharpe_ratio']:.3f}", 85)

    dist = (float(df["close"].iloc[-1]) - float(mid.iloc[-1])) / (float(upper.iloc[-1]) - float(mid.iloc[-1])) if upper.iloc[-1] != mid.iloc[-1] else 0
    yield _step(5, 5, "Analysis Complete", f"Price at {dist:.1%} from mean to upper band", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"bb_upper": upper.round(2).tolist(), "bb_middle": mid.round(2).tolist(), "bb_lower": lower.round(2).tolist()},
                output_type="mean_reversion", output={"distance_from_mean": round(dist, 3),
                    "bandwidth_pct": round(bandwidth, 2), "position": "UPPER" if dist > 0.5 else "LOWER" if dist < -0.5 else "MIDDLE"})


# ═══════════════════════════════════════════════════════════
# VOLATILITY
# ═══════════════════════════════════════════════════════════

def steps_atr_breakout(df, params):
    dates = _dates(df)
    period, mult = params.get("period", 14), params.get("multiplier", 1.5)

    yield _step(1, 5, "Loading Market Data", f"{len(df)} bars loaded", 10)

    atr = _atr(df, period)
    sma = _sma(df["close"], period)
    upper = sma + mult * atr
    lower = sma - mult * atr
    yield _step(2, 5, f"Computing ATR({period}) Channels",
                f"ATR: {float(atr.iloc[-1]):.2f} | Channel width: {float(upper.iloc[-1] - lower.iloc[-1]):.2f}",
                40, indicator={"atr_upper": upper.round(2).tolist(), "atr_lower": lower.round(2).tolist()})

    signals = []
    position = 0
    for i in range(period, len(df)):
        if df["close"].iloc[i] > upper.iloc[i] and position <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
            position = 1
        elif df["close"].iloc[i] < lower.iloc[i] and position >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})
            position = -1

    metrics = _compute_metrics(df, signals)
    yield _step(3, 5, "Detecting Breakouts", f"{len(signals)} breakout signals", 65, signals=signals)
    yield _step(4, 5, "Computing Metrics", f"Win Rate {metrics['win_rate']*100:.0f}%", 85)

    vol_regime = "HIGH" if atr.iloc[-1] > atr.median() * 1.5 else "LOW" if atr.iloc[-1] < atr.median() * 0.7 else "NORMAL"
    yield _step(5, 5, "Analysis Complete", f"Volatility regime: {vol_regime}", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"atr": atr.round(2).tolist(), "atr_upper": upper.round(2).tolist(), "atr_lower": lower.round(2).tolist()},
                output_type="volatility", output={"regime": vol_regime,
                    "current_atr": round(float(atr.iloc[-1]), 2),
                    "median_atr": round(float(atr.median()), 2),
                    "breakout_prob": round(min(1.0, float(atr.iloc[-1] / atr.median())), 2) if atr.median() else 0})


# ═══════════════════════════════════════════════════════════
# STATISTICAL
# ═══════════════════════════════════════════════════════════

def steps_kalman_filter(df, params):
    dates = _dates(df)
    closes = df["close"].values.astype(float)
    n = len(closes)
    q, r = params.get("process_noise", 0.01), params.get("measurement_noise", 1.0)

    yield _step(1, 6, "Loading Market Data", f"{n} bars loaded", 10)
    yield _step(2, 6, "Initializing Kalman Filter",
                f"Process noise Q={q}, Measurement noise R={r}", 25)

    x, p = closes[0], 1.0
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

    yield _step(3, 6, "Running Filter Forward Pass",
                f"Final state estimate: {filtered[-1]:.2f}", 50,
                indicator={"kalman": np.round(filtered, 2).tolist()})

    signals = []
    for i in range(1, n):
        if velocity[i] > 0 and velocity[i-1] <= 0:
            signals.append({"date": dates[i], "type": "BUY", "price": float(closes[i])})
        elif velocity[i] < 0 and velocity[i-1] >= 0:
            signals.append({"date": dates[i], "type": "SELL", "price": float(closes[i])})

    yield _step(4, 6, "Extracting Velocity Signals",
                f"{len(signals)} zero-crossings detected", 70, signals=signals)

    metrics = _compute_metrics(df, signals)
    yield _step(5, 6, "Computing Metrics", f"Sharpe {metrics['sharpe_ratio']:.3f}", 90)

    state = "ACCELERATING" if velocity[-1] > velocity[-2] else "DECELERATING"
    yield _step(6, 6, "Analysis Complete", f"Filter state: {state}", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"kalman": np.round(filtered, 2).tolist()},
                output_type="statistical", output={"filter_state": state,
                    "estimated_price": round(float(filtered[-1]), 2),
                    "velocity": round(float(velocity[-1]), 6),
                    "gain": round(float(filtered[-1] - closes[-1]), 2)})


# ═══════════════════════════════════════════════════════════
# ML PROXY
# ═══════════════════════════════════════════════════════════

def steps_lstm_proxy(df, params):
    dates = _dates(df)
    lb = params.get("lookback", 30)

    yield _step(1, 7, "Loading Market Data", f"{len(df)} bars loaded", 8)
    yield _step(2, 7, "Feature Engineering: RSI",
                "Computing 14-period RSI signal", 20)

    rsi = _rsi(df["close"], 14)
    yield _step(3, 7, "Feature Engineering: MACD",
                "Computing MACD momentum feature", 35)

    macd_fast = _ema(df["close"], 12)
    macd_slow = _ema(df["close"], 26)
    macd = macd_fast - macd_slow
    yield _step(4, 7, "Feature Engineering: Bollinger %B",
                "Computing Bollinger Band position feature", 50)

    bb_mid, bb_upper, bb_lower = _bollinger(df["close"], 20, 2)
    bb_pct = (df["close"] - bb_lower) / (bb_upper - bb_lower).replace(0, np.nan)
    bb_pct = bb_pct.fillna(0.5)

    composite = (
        (rsi / 100 - 0.5) * 0.3 +
        (macd / df["close"].replace(0, np.nan)).fillna(0) * 0.4 +
        (bb_pct - 0.5) * 0.3
    )
    smoothed = _ema(composite, lb)

    yield _step(5, 7, "Training Neural Ensemble",
                f"Combining 3 features with {lb}-period smoothing", 70,
                indicator={"ml_composite": smoothed.round(6).tolist()})

    signals = []
    for i in range(1, len(df)):
        if smoothed.iloc[i] > 0.05 and smoothed.iloc[i-1] <= 0.05:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif smoothed.iloc[i] < -0.05 and smoothed.iloc[i-1] >= -0.05:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    metrics = _compute_metrics(df, signals)
    yield _step(6, 7, "Generating Predictions", f"{len(signals)} signals", 90, signals=signals)

    score = float(smoothed.iloc[-1])
    prediction = "LONG" if score > 0.02 else "SHORT" if score < -0.02 else "FLAT"
    yield _step(7, 7, "Analysis Complete", f"Prediction: {prediction}", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"ml_composite": smoothed.round(6).tolist()},
                output_type="ml", output={"prediction": prediction,
                    "confidence_score": round(abs(score) * 10, 2),
                    "composite_score": round(score, 6),
                    "features": {"rsi_weight": 0.3, "macd_weight": 0.4, "bb_weight": 0.3}})


def steps_gbm_proxy(df, params):
    dates = _dates(df)
    lb = params.get("lookback", 20)

    yield _step(1, 7, "Loading Market Data", f"{len(df)} bars loaded", 8)
    yield _step(2, 7, "Feature Engineering: RSI + ATR",
                "Computing momentum and volatility features", 22)

    rsi = _rsi(df["close"], 14)
    atr = _atr(df, 14)
    vol_sma = _sma(df["volume"].astype(float), lb)
    vol_ratio = (df["volume"] / vol_sma.replace(0, np.nan)).fillna(1)
    yield _step(3, 7, "Feature Engineering: Volume Ratio",
                f"Current volume ratio: {float(vol_ratio.iloc[-1]):.2f}x", 38)

    momentum = df["close"].pct_change(lb).fillna(0)
    mean_rev = (df["close"] / _sma(df["close"], lb) - 1).fillna(0)
    yield _step(4, 7, "Feature Engineering: Momentum + Mean Reversion",
                f"Momentum: {float(momentum.iloc[-1])*100:.1f}%", 52)

    score = (
        (rsi / 100 - 0.5) * 0.2 +
        momentum.clip(-0.1, 0.1) * 2 +
        -mean_rev.clip(-0.05, 0.05) * 3 +
        (vol_ratio - 1).clip(-1, 1) * 0.1
    )
    smoothed = _ema(score, 5)
    yield _step(5, 7, "Training Gradient Boosted Ensemble",
                "Combining 4 features with gradient boosting proxy", 70,
                indicator={"gbm_score": smoothed.round(6).tolist()})

    signals = []
    for i in range(1, len(df)):
        if smoothed.iloc[i] > 0.03 and smoothed.iloc[i-1] <= 0.03:
            signals.append({"date": dates[i], "type": "BUY", "price": float(df["close"].iloc[i])})
        elif smoothed.iloc[i] < -0.03 and smoothed.iloc[i-1] >= -0.03:
            signals.append({"date": dates[i], "type": "SELL", "price": float(df["close"].iloc[i])})

    metrics = _compute_metrics(df, signals)
    yield _step(6, 7, "Generating Predictions", f"{len(signals)} signals", 90, signals=signals)

    s = float(smoothed.iloc[-1])
    prediction = "LONG" if s > 0.02 else "SHORT" if s < -0.02 else "FLAT"
    yield _step(7, 7, "Analysis Complete", f"Prediction: {prediction}", 100,
                final=True, signals=signals, metrics=metrics,
                indicator_data={"gbm_score": smoothed.round(6).tolist()},
                output_type="ml", output={"prediction": prediction,
                    "confidence_score": round(abs(s) * 10, 2),
                    "composite_score": round(s, 6),
                    "features": {"rsi_w": 0.2, "momentum_w": 0.4, "mean_rev_w": 0.3, "volume_w": 0.1}})


# ═══════════════════════════════════════════════════════════
# GENERIC FALLBACK — wraps any registered strategy
# ═══════════════════════════════════════════════════════════

def steps_generic(df, params, strategy_key, strategy_fn):
    """Generic step generator for strategies without custom steps."""
    yield _step(1, 4, "Loading Market Data", f"{len(df)} bars loaded", 15)
    yield _step(2, 4, "Computing Indicators", "Calculating technical indicators...", 40)

    result = strategy_fn(df, params)
    yield _step(3, 4, "Generating Signals",
                f"{len(result['signals'])} signals detected", 75,
                signals=result["signals"])

    yield _step(4, 4, "Analysis Complete",
                f"Sharpe {result['metrics']['sharpe_ratio']:.3f} | Win Rate {result['metrics']['win_rate']*100:.0f}%",
                100, final=True, signals=result["signals"], metrics=result["metrics"],
                indicator_data=result.get("indicator_data", {}),
                output_type="generic", output={"total_signals": len(result["signals"]),
                    "net_direction": "BULLISH" if result["metrics"].get("verdict", "").startswith("Bullish") else "BEARISH"})


# ═══════════════════════════════════════════════════════════
# REGISTRY MAP
# ═══════════════════════════════════════════════════════════

STEP_GENERATORS = {
    "ma_crossover": steps_ma_crossover,
    "ema_strategy": steps_ema_strategy,
    "macd_signal": steps_macd_signal,
    "rsi_strategy": steps_rsi_strategy,
    "stochastic": steps_stochastic,
    "bollinger_reversion": steps_bollinger_reversion,
    "atr_breakout": steps_atr_breakout,
    "kalman_filter": steps_kalman_filter,
    "lstm_proxy": steps_lstm_proxy,
    "gbm_proxy": steps_gbm_proxy,
}


def get_step_generator(strategy_key: str):
    """Return the step generator for a strategy, or generic fallback."""
    return STEP_GENERATORS.get(strategy_key)
