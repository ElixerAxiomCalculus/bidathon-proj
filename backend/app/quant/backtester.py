"""
Vectorized Backtesting Engine.

Takes OHLCV DataFrame + strategy signals and produces:
  - Equity curve (daily portfolio value)
  - Trade log (entry/exit records with P&L)
  - Performance metrics
"""

import numpy as np
import pandas as pd


def run_backtest(
    df: pd.DataFrame,
    signals: list[dict],
    initial_capital: float = 100000.0,
) -> dict:
    """
    Execute a vectorized backtest from strategy signals.

    Parameters
    ----------
    df : pd.DataFrame
        OHLCV data with columns: date, open, high, low, close, volume
    signals : list[dict]
        Each signal has: date, type (BUY/SELL), price
    initial_capital : float
        Starting portfolio value

    Returns
    -------
    dict with equity_curve, trade_log, metrics, final_value, total_return_pct
    """
    if not signals or df.empty:
        return {
            "equity_curve": [],
            "trade_log": [],
            "metrics": _empty_metrics(),
            "initial_capital": initial_capital,
            "final_value": initial_capital,
            "total_return_pct": 0.0,
        }

    dates = df["date"].astype(str).tolist()
    closes = df["close"].values.astype(float)

    # Build signal lookup: date -> (type, price)
    signal_map = {}
    for s in signals:
        signal_map[s["date"]] = (s["type"], s["price"])

    # Simulation
    cash = initial_capital
    position = 0
    shares = 0
    entry_price = 0.0
    trade_log = []
    equity = []
    cumulative_pnl = 0.0

    for i in range(len(df)):
        date = dates[i]
        price = closes[i]

        if date in signal_map:
            sig_type, sig_price = signal_map[date]
            execution_price = price  # Use close price for execution

            if sig_type == "BUY" and position <= 0:
                # Close short if any
                if position < 0:
                    pnl = (entry_price - execution_price) * shares
                    cumulative_pnl += pnl
                    cash += pnl + entry_price * shares
                    trade_log.append({
                        "date": date,
                        "type": "COVER",
                        "price": round(execution_price, 2),
                        "quantity": shares,
                        "pnl": round(pnl, 2),
                        "cumulative_pnl": round(cumulative_pnl, 2),
                    })

                # Open long
                shares = int(cash * 0.95 / execution_price) if execution_price > 0 else 0
                if shares > 0:
                    cost = shares * execution_price
                    cash -= cost
                    entry_price = execution_price
                    position = 1
                    trade_log.append({
                        "date": date,
                        "type": "BUY",
                        "price": round(execution_price, 2),
                        "quantity": shares,
                        "pnl": 0.0,
                        "cumulative_pnl": round(cumulative_pnl, 2),
                    })

            elif sig_type == "SELL" and position >= 0:
                # Close long if any
                if position > 0:
                    pnl = (execution_price - entry_price) * shares
                    cumulative_pnl += pnl
                    cash += shares * execution_price
                    trade_log.append({
                        "date": date,
                        "type": "SELL",
                        "price": round(execution_price, 2),
                        "quantity": shares,
                        "pnl": round(pnl, 2),
                        "cumulative_pnl": round(cumulative_pnl, 2),
                    })
                    shares = 0
                    position = 0
                    entry_price = 0.0

        # Mark-to-market
        portfolio_value = cash + (shares * price if position == 1 else 0)
        equity.append({
            "date": date,
            "value": round(portfolio_value, 2),
            "cash": round(cash, 2),
            "position_value": round(shares * price if position == 1 else 0, 2),
        })

    # Close any open position at end
    if position != 0 and shares > 0:
        final_price = closes[-1]
        if position == 1:
            pnl = (final_price - entry_price) * shares
            cumulative_pnl += pnl
            cash += shares * final_price
        trade_log.append({
            "date": dates[-1],
            "type": "CLOSE",
            "price": round(final_price, 2),
            "quantity": shares,
            "pnl": round(pnl, 2),
            "cumulative_pnl": round(cumulative_pnl, 2),
        })

    final_value = cash
    total_return_pct = round((final_value - initial_capital) / initial_capital * 100, 2)

    # Compute metrics from equity curve
    eq_values = [e["value"] for e in equity]
    metrics = _compute_backtest_metrics(eq_values, trade_log, initial_capital)

    return {
        "equity_curve": equity,
        "trade_log": trade_log,
        "metrics": metrics,
        "initial_capital": initial_capital,
        "final_value": round(final_value, 2),
        "total_return_pct": total_return_pct,
    }


def _compute_backtest_metrics(equity: list[float], trade_log: list[dict], initial_capital: float) -> dict:
    if len(equity) < 2:
        return _empty_metrics()

    eq = np.array(equity)
    returns = np.diff(eq) / eq[:-1]
    returns = returns[np.isfinite(returns)]

    sharpe = float(np.mean(returns) / np.std(returns) * np.sqrt(252)) if np.std(returns) > 0 else 0

    # Max drawdown
    peak = np.maximum.accumulate(eq)
    drawdown = (peak - eq) / peak * 100
    max_dd = float(np.max(drawdown)) if len(drawdown) > 0 else 0

    # Trade-level stats
    pnls = [t["pnl"] for t in trade_log if t["type"] in ("SELL", "COVER", "CLOSE") and t["pnl"] != 0]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    total_trades = len(pnls)
    win_rate = len(wins) / total_trades if total_trades > 0 else 0
    avg_win = float(np.mean(wins)) if wins else 0
    avg_loss = float(abs(np.mean(losses))) if losses else 0
    profit_factor = (sum(wins) / abs(sum(losses))) if losses and sum(losses) != 0 else (999.0 if wins else 0)

    final = eq[-1]
    net_pnl = final - initial_capital
    risk_level = "LOW" if max_dd < 10 else ("MODERATE" if max_dd < 25 else "HIGH")
    confidence = min(0.9, win_rate * 0.8 + (1 if sharpe > 1 else 0) * 0.2)

    verdict = (
        f"{'Profitable' if net_pnl > 0 else 'Unprofitable'} strategy. "
        f"{total_trades} trades, {win_rate*100:.0f}% win rate, "
        f"Sharpe {sharpe:.2f}, max drawdown {max_dd:.1f}%."
    )

    return {
        "sharpe_ratio": round(sharpe, 3),
        "max_drawdown": round(max_dd, 2),
        "win_rate": round(win_rate, 3),
        "total_trades": total_trades,
        "profit_factor": round(float(profit_factor), 3),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "risk_level": risk_level,
        "confidence": round(confidence, 3),
        "verdict": verdict,
        "suggested_position_pct": max(2, min(25, int(win_rate * 30))),
    }


def _empty_metrics() -> dict:
    return {
        "sharpe_ratio": 0.0, "max_drawdown": 0.0, "win_rate": 0.0,
        "total_trades": 0, "profit_factor": 0.0, "avg_win": 0.0,
        "avg_loss": 0.0, "risk_level": "LOW", "confidence": 0.0,
        "verdict": "No trades executed", "suggested_position_pct": 0.0,
    }
