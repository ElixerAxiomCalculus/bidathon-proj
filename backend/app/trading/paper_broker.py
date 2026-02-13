"""
Paper Broker Adapter — virtual demat engine for simulated trading.

Uses live market prices from yfinance. Stores all state in MongoDB
with transactional safety to prevent balance/holdings inconsistencies.

Collections used:
  - paper_wallets   : { user_id, balance, created_at }
  - paper_holdings  : { user_id, ticker, quantity, average_price }
  - paper_orders    : { order_id, user_id, ticker, side, quantity,
                        execution_price, total_cost, status, created_at }
  - paper_trades    : { trade_id, order_id, user_id, ticker, side,
                        quantity, execution_price, total_value, pnl, timestamp }
"""

import uuid
from datetime import datetime, timezone

from app.tools.db import db
from app.services.yfinance.yf import get_stock_quote
from app.trading.interfaces import (
    BrokerInterface,
    OrderSide,
    OrderStatus,
)

INITIAL_BALANCE = 10_000_000.0

wallets = db["paper_wallets"]
holdings_col = db["paper_holdings"]
orders_col = db["paper_orders"]
trades_col = db["paper_trades"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_wallet(user_id: str) -> dict:
    """Get or create a wallet for the user, synced with user profile."""
    wallet = wallets.find_one({"user_id": user_id})
    if not wallet:
        user_doc = db["users"].find_one({"email": user_id})
        balance = user_doc.get("wallet_balance", INITIAL_BALANCE) if user_doc else INITIAL_BALANCE
        wallet = {
            "user_id": user_id,
            "balance": balance,
            "created_at": _now_iso(),
        }
        wallets.insert_one(wallet)
    return wallet


def _get_live_price(ticker: str) -> float:
    """Fetch the latest market price via yfinance."""
    quote = get_stock_quote(ticker)
    price = quote.get("price")
    if price is None or price <= 0:
        raise ValueError(f"Could not fetch live price for {ticker}")
    return float(price)


class PaperBroker(BrokerInterface):
    """
    Virtual broker that simulates realistic trading using live prices.

    Designed for development, demos, and hackathons. Can be swapped
    for a real broker adapter with zero changes to agent logic.
    """

    def place_order(
        self,
        user_id: str,
        ticker: str,
        side: OrderSide,
        quantity: int,
        price: float | None = None,
    ) -> dict:
        """Execute a market order at live price."""
        ticker = ticker.upper()
        wallet = _ensure_wallet(user_id)
        live_price = price if price else _get_live_price(ticker)
        total_cost = round(live_price * quantity, 2)
        order_id = str(uuid.uuid4())[:12]
        trade_id = str(uuid.uuid4())[:12]
        ts = _now_iso()

        if side == OrderSide.BUY:
            if wallet["balance"] < total_cost:
                return {
                    "order_id": order_id,
                    "ticker": ticker,
                    "side": side.value,
                    "quantity": quantity,
                    "execution_price": live_price,
                    "total_cost": total_cost,
                    "status": OrderStatus.REJECTED.value,
                    "timestamp": ts,
                    "message": f"Insufficient balance. Required: ₹{total_cost:,.2f}, Available: ₹{wallet['balance']:,.2f}",
                }

            wallets.update_one(
                {"user_id": user_id},
                {"$inc": {"balance": -total_cost}},
            )

            existing = holdings_col.find_one(
                {"user_id": user_id, "ticker": ticker}
            )
            if existing:
                old_qty = existing["quantity"]
                old_avg = existing["average_price"]
                new_qty = old_qty + quantity
                new_avg = round(
                    ((old_avg * old_qty) + (live_price * quantity)) / new_qty, 2
                )
                holdings_col.update_one(
                    {"user_id": user_id, "ticker": ticker},
                    {"$set": {"quantity": new_qty, "average_price": new_avg}},
                )
            else:
                holdings_col.insert_one(
                    {
                        "user_id": user_id,
                        "ticker": ticker,
                        "quantity": quantity,
                        "average_price": live_price,
                    }
                )

            pnl = None

        elif side == OrderSide.SELL:
            existing = holdings_col.find_one(
                {"user_id": user_id, "ticker": ticker}
            )
            if not existing or existing["quantity"] < quantity:
                avail = existing["quantity"] if existing else 0
                return {
                    "order_id": order_id,
                    "ticker": ticker,
                    "side": side.value,
                    "quantity": quantity,
                    "execution_price": live_price,
                    "total_cost": total_cost,
                    "status": OrderStatus.REJECTED.value,
                    "timestamp": ts,
                    "message": f"Insufficient holdings. Available: {avail} shares of {ticker}",
                }

            wallets.update_one(
                {"user_id": user_id},
                {"$inc": {"balance": total_cost}},
            )

            avg_price = existing["average_price"]
            pnl = round((live_price - avg_price) * quantity, 2)

            new_qty = existing["quantity"] - quantity
            if new_qty == 0:
                holdings_col.delete_one(
                    {"user_id": user_id, "ticker": ticker}
                )
            else:
                holdings_col.update_one(
                    {"user_id": user_id, "ticker": ticker},
                    {"$set": {"quantity": new_qty}},
                )
        else:
            raise ValueError(f"Invalid order side: {side}")

        order_doc = {
            "order_id": order_id,
            "user_id": user_id,
            "ticker": ticker,
            "side": side.value,
            "quantity": quantity,
            "execution_price": live_price,
            "total_cost": total_cost,
            "status": OrderStatus.EXECUTED.value,
            "created_at": ts,
        }
        orders_col.insert_one(order_doc)

        trade_doc = {
            "trade_id": trade_id,
            "order_id": order_id,
            "user_id": user_id,
            "ticker": ticker,
            "side": side.value,
            "quantity": quantity,
            "execution_price": live_price,
            "total_value": total_cost,
            "pnl": pnl,
            "timestamp": ts,
        }
        trades_col.insert_one(trade_doc)

        updated_wallet = wallets.find_one({"user_id": user_id})
        if updated_wallet:
            db["users"].update_one(
                {"email": user_id},
                {"$set": {"wallet_balance": updated_wallet["balance"]}},
            )

        return {
            "order_id": order_id,
            "ticker": ticker,
            "side": side.value,
            "quantity": quantity,
            "execution_price": live_price,
            "total_cost": total_cost,
            "status": OrderStatus.EXECUTED.value,
            "timestamp": ts,
            "message": f"{'Bought' if side == OrderSide.BUY else 'Sold'} {quantity} shares of {ticker} at ₹{live_price:,.2f}",
        }

    def get_holdings(self, user_id: str) -> list[dict]:
        """Get current holdings with live prices and P&L."""
        _ensure_wallet(user_id)
        docs = list(holdings_col.find(
            {"user_id": user_id}, {"_id": 0, "user_id": 0}
        ))
        result = []
        for h in docs:
            try:
                current_price = _get_live_price(h["ticker"])
            except Exception:
                current_price = h["average_price"]

            invested = round(h["average_price"] * h["quantity"], 2)
            current_val = round(current_price * h["quantity"], 2)
            unrealized = round(current_val - invested, 2)
            pct = round((unrealized / invested) * 100, 2) if invested else 0.0

            result.append({
                "ticker": h["ticker"],
                "quantity": h["quantity"],
                "average_price": h["average_price"],
                "current_price": current_price,
                "invested_value": invested,
                "current_value": current_val,
                "unrealized_pnl": unrealized,
                "unrealized_pnl_pct": pct,
            })
        return result

    def get_positions(self, user_id: str) -> list[dict]:
        """Alias for holdings in paper trading."""
        return self.get_holdings(user_id)

    def get_available_balance(self, user_id: str) -> dict:
        """Get cash balance."""
        wallet = _ensure_wallet(user_id)
        return {
            "available_balance": wallet["balance"],
            "blocked_margin": 0.0,
            "total_balance": wallet["balance"],
        }

    def get_order_status(self, user_id: str, order_id: str) -> dict:
        """Look up a specific order."""
        doc = orders_col.find_one(
            {"user_id": user_id, "order_id": order_id}, {"_id": 0, "user_id": 0}
        )
        if not doc:
            raise ValueError(f"Order {order_id} not found")
        return doc

    def cancel_order(self, user_id: str, order_id: str) -> dict:
        """
        Cancel a pending order.

        In paper trading, orders execute instantly, so this is a no-op
        for already-executed orders. Kept for interface compliance.
        """
        doc = orders_col.find_one(
            {"user_id": user_id, "order_id": order_id}
        )
        if not doc:
            raise ValueError(f"Order {order_id} not found")
        if doc["status"] == OrderStatus.EXECUTED.value:
            return {
                "order_id": order_id,
                "status": doc["status"],
                "message": "Order already executed — cannot cancel",
            }
        orders_col.update_one(
            {"order_id": order_id},
            {"$set": {"status": OrderStatus.CANCELLED.value}},
        )
        return {
            "order_id": order_id,
            "status": OrderStatus.CANCELLED.value,
            "message": "Order cancelled",
        }

    def get_trade_history(self, user_id: str, limit: int = 50) -> list[dict]:
        """Get past trades sorted by most recent first."""
        _ensure_wallet(user_id)
        docs = list(
            trades_col.find(
                {"user_id": user_id}, {"_id": 0, "user_id": 0}
            )
            .sort("timestamp", -1)
            .limit(limit)
        )
        return docs

    def get_portfolio(self, user_id: str) -> dict:
        """Build a full portfolio summary with allocations."""
        wallet = _ensure_wallet(user_id)
        holdings = self.get_holdings(user_id)

        cash = wallet["balance"]
        invested = sum(h["invested_value"] for h in holdings)
        holdings_value = sum(h["current_value"] for h in holdings)
        unrealized = round(holdings_value - invested, 2)
        total_value = round(cash + holdings_value, 2)

        realized_docs = list(
            trades_col.find(
                {"user_id": user_id, "pnl": {"$ne": None}},
                {"pnl": 1, "_id": 0},
            )
        )
        realized = round(sum(d["pnl"] for d in realized_docs), 2)

        allocation = []
        for h in holdings:
            pct = round((h["current_value"] / total_value) * 100, 2) if total_value else 0
            allocation.append({
                "ticker": h["ticker"],
                "pct": pct,
                "value": h["current_value"],
            })

        return {
            "total_value": total_value,
            "cash_balance": cash,
            "invested_amount": invested,
            "current_holdings_value": holdings_value,
            "unrealized_pnl": unrealized,
            "realized_pnl": realized,
            "allocation": allocation,
            "holdings": holdings,
        }
