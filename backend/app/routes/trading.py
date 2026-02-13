"""
Trading API routes — JWT-protected endpoints for order management,
portfolio, holdings, and trade history.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_current_user
from app.trading.models import (
    OrderPreviewRequest,
    OrderExecuteRequest,
)
from app.trading import service

router = APIRouter(prefix="/trading", tags=["trading"])


@router.post("/order/preview")
def order_preview(body: OrderPreviewRequest, user=Depends(get_current_user)):
    """Preview an order before execution — shows price, cost, balance check."""
    try:
        preview = service.preview_order(
            user_id=user["email"],
            ticker=body.ticker,
            side=body.side,
            quantity=body.quantity,
        )
        return preview
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {e}")


@router.post("/order/execute")
def order_execute(body: OrderExecuteRequest, user=Depends(get_current_user)):
    """Execute a confirmed order through the broker adapter."""
    if not body.confirmed:
        raise HTTPException(status_code=400, detail="Order must be confirmed before execution")
    try:
        result = service.execute_order(
            user_id=user["email"],
            ticker=body.ticker,
            side=body.side,
            quantity=body.quantity,
        )
        if result.get("status") == "REJECTED":
            raise HTTPException(status_code=400, detail=result.get("message", "Order rejected"))
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {e}")


@router.get("/holdings")
def get_holdings(user=Depends(get_current_user)):
    """Get current stock holdings with live P&L."""
    try:
        return {"holdings": service.get_holdings(user_id=user["email"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/portfolio")
def get_portfolio(user=Depends(get_current_user)):
    """Get full portfolio summary with allocations."""
    try:
        return service.get_portfolio(user_id=user["email"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders")
def get_orders(user=Depends(get_current_user)):
    """Get order / trade history."""
    try:
        return {"orders": service.get_orders(user_id=user["email"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trades")
def get_trades(user=Depends(get_current_user)):
    """Get executed trade history."""
    try:
        return {"trades": service.get_trades(user_id=user["email"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/balance")
def get_balance(user=Depends(get_current_user)):
    """Get available cash balance."""
    try:
        return service.get_balance(user_id=user["email"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
