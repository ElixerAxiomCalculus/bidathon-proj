"""
Broker Factory — instantiates the correct broker adapter at runtime.

Uses factory pattern for dynamic broker selection per user.
Adding a new broker requires only a new adapter class and a
single entry in the _BROKERS registry.
"""

from app.trading.interfaces import BrokerInterface
from app.trading.paper_broker import PaperBroker

_BROKERS: dict[str, type[BrokerInterface]] = {
    "paper": PaperBroker,
}

_instances: dict[str, BrokerInterface] = {}


def get_broker(broker_type: str = "paper") -> BrokerInterface:
    """
    Get a broker adapter instance.

    Uses singleton pattern — one instance per broker type.
    """
    if broker_type not in _BROKERS:
        raise ValueError(
            f"Unknown broker type: {broker_type}. "
            f"Available: {list(_BROKERS.keys())}"
        )
    if broker_type not in _instances:
        _instances[broker_type] = _BROKERS[broker_type]()
    return _instances[broker_type]


def register_broker(name: str, cls: type[BrokerInterface]) -> None:
    """Register a new broker adapter at runtime."""
    _BROKERS[name] = cls
