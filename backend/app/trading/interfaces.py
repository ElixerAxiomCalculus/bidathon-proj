"""
Abstract Broker Interface — the contract every broker adapter must fulfill.

Defines a standardized set of methods for order management, holdings,
portfolio, and trade history. All return structured dicts suitable for
LLM grounding and frontend rendering.
"""

from abc import ABC, abstractmethod
from enum import Enum


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class BrokerInterface(ABC):
    """
    Standardized broker abstraction.

    Every broker adapter (paper, Zerodha, Groww, etc.) must implement
    these methods. The trading service and AI agent communicate
    exclusively through this interface.
    """

    @abstractmethod
    def place_order(
        self,
        user_id: str,
        ticker: str,
        side: OrderSide,
        quantity: int,
        price: float | None = None,
    ) -> dict:
        """
        Place a market or limit order.

        Returns:
            {
                "order_id": str,
                "ticker": str,
                "side": "BUY" | "SELL",
                "quantity": int,
                "execution_price": float,
                "total_cost": float,
                "status": OrderStatus,
                "timestamp": str (ISO),
            }
        """
        ...

    @abstractmethod
    def get_holdings(self, user_id: str) -> list[dict]:
        """
        Get current stock holdings for a user.

        Returns list of:
            {
                "ticker": str,
                "quantity": int,
                "average_price": float,
                "current_price": float,
                "invested_value": float,
                "current_value": float,
                "unrealized_pnl": float,
                "unrealized_pnl_pct": float,
            }
        """
        ...

    @abstractmethod
    def get_positions(self, user_id: str) -> list[dict]:
        """
        Get open positions (alias for holdings in paper trading,
        may differ for margin/futures in real brokers).
        """
        ...

    @abstractmethod
    def get_available_balance(self, user_id: str) -> dict:
        """
        Get the available cash balance.

        Returns:
            {
                "available_balance": float,
                "blocked_margin": float,
                "total_balance": float,
            }
        """
        ...

    @abstractmethod
    def get_order_status(self, user_id: str, order_id: str) -> dict:
        """
        Get the status of a specific order.

        Returns the same structure as place_order().
        """
        ...

    @abstractmethod
    def cancel_order(self, user_id: str, order_id: str) -> dict:
        """
        Cancel a pending/confirmed order.

        Returns:
            {"order_id": str, "status": "CANCELLED", "message": str}
        """
        ...

    @abstractmethod
    def get_trade_history(
        self, user_id: str, limit: int = 50
    ) -> list[dict]:
        """
        Get historical executed trades.

        Returns list of:
            {
                "trade_id": str,
                "order_id": str,
                "ticker": str,
                "side": str,
                "quantity": int,
                "execution_price": float,
                "pnl": float | None,
                "timestamp": str,
            }
        """
        ...

    @abstractmethod
    def get_portfolio(self, user_id: str) -> dict:
        """
        Get a full portfolio summary.

        Returns:
            {
                "total_value": float,
                "cash_balance": float,
                "invested_amount": float,
                "current_holdings_value": float,
                "unrealized_pnl": float,
                "realized_pnl": float,
                "allocation": list[{ticker, pct, value}],
                "holdings": list[...],
            }
        """
        ...
