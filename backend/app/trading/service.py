"""
Trading Service — orchestrates order lifecycle between
the AI agent / API routes and the broker adapter.

Responsibilities:
  - Order preview (price lookup + validation before execution)
  - Order execution (delegate to broker)
  - Portfolio, holdings, balance, trade history retrieval
  - Safety checks (balance, holdings, duplicate prevention)
"""

from app.trading.factory import get_broker
from app.trading.interfaces import OrderSide
from app.services.yfinance.yf import get_stock_quote


def _live_price(ticker: str) -> float:
    """Fetch live price, raise on failure."""
    quote = get_stock_quote(ticker)
    price = quote.get("price")
    if price is None or price <= 0:
        raise ValueError(f"Cannot fetch price for {ticker}")
    return float(price)


def preview_order(
    user_id: str,
    ticker: str,
    side: str,
    quantity: int,
    broker_type: str = "paper",
) -> dict:
    """
    Generate an order preview without executing.

    Fetches live price, checks balance/holdings, and returns
    a preview object the frontend can display for confirmation.
    """
    broker = get_broker(broker_type)
    ticker = ticker.upper()

    current_price = _live_price(ticker)
    total_cost = round(current_price * quantity, 2)
    balance_info = broker.get_available_balance(user_id)
    available = balance_info["available_balance"]

    preview = {
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "current_price": current_price,
        "total_cost": total_cost,
        "available_balance": available,
        "sufficient_funds": True,
        "holdings_available": None,
        "message": "",
    }

    if side == "BUY":
        if available < total_cost:
            preview["sufficient_funds"] = False
            preview["message"] = (
                f"Insufficient funds. Need ₹{total_cost:,.2f} but only ₹{available:,.2f} available."
            )
        else:
            remaining = round(available - total_cost, 2)
            preview["message"] = (
                f"Buy {quantity} shares of {ticker} at ₹{current_price:,.2f} "
                f"for ₹{total_cost:,.2f}. Remaining balance: ₹{remaining:,.2f}"
            )

    elif side == "SELL":
        holdings = broker.get_holdings(user_id)
        holding = next((h for h in holdings if h["ticker"] == ticker), None)
        owned = holding["quantity"] if holding else 0
        preview["holdings_available"] = owned

        if owned < quantity:
            preview["sufficient_funds"] = False
            preview["message"] = (
                f"Insufficient holdings. You own {owned} shares of {ticker} "
                f"but want to sell {quantity}."
            )
        else:
            avg = holding["average_price"] if holding else 0
            estimated_pnl = round((current_price - avg) * quantity, 2)
            preview["message"] = (
                f"Sell {quantity} shares of {ticker} at ₹{current_price:,.2f} "
                f"for ₹{total_cost:,.2f}. Estimated P&L: ₹{estimated_pnl:+,.2f}"
            )

    return preview


def execute_order(
    user_id: str,
    ticker: str,
    side: str,
    quantity: int,
    broker_type: str = "paper",
) -> dict:
    """
    Execute an order through the broker adapter.

    The caller must have already shown the user a preview
    and received confirmation before calling this.
    """
    broker = get_broker(broker_type)
    order_side = OrderSide.BUY if side == "BUY" else OrderSide.SELL
    return broker.place_order(user_id, ticker, order_side, quantity)


def get_holdings(user_id: str, broker_type: str = "paper") -> list[dict]:
    return get_broker(broker_type).get_holdings(user_id)


def get_portfolio(user_id: str, broker_type: str = "paper") -> dict:
    return get_broker(broker_type).get_portfolio(user_id)


def get_orders(user_id: str, broker_type: str = "paper") -> list[dict]:
    return get_broker(broker_type).get_trade_history(user_id)


def get_trades(user_id: str, broker_type: str = "paper") -> list[dict]:
    return get_broker(broker_type).get_trade_history(user_id)


def get_balance(user_id: str, broker_type: str = "paper") -> dict:
    return get_broker(broker_type).get_available_balance(user_id)
