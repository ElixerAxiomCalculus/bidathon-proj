"""
Calculator routes — deterministic financial math endpoints.
"""

from fastapi import APIRouter

from app.models.agent import (
    SipRequest, SipResponse,
    EmiRequest, EmiResponse,
    CompoundRequest, CompoundResponse,
)
from app.services.calculators.sip import calculate_sip
from app.services.calculators.emi import calculate_emi
from app.services.calculators.compound import calculate_compound_interest

router = APIRouter(prefix="/calc", tags=["calculators"])


@router.post("/sip", response_model=SipResponse)
def sip_calculator(body: SipRequest):
    """
    Calculate SIP (Systematic Investment Plan) returns.

    - monthly_investment: Amount invested every month
    - annual_return_rate: Expected annual return (e.g. 12 for 12%)
    - years: Investment duration
    """
    return calculate_sip(
        monthly_investment=body.monthly_investment,
        annual_return_rate=body.annual_return_rate,
        years=body.years,
    )


@router.post("/emi", response_model=EmiResponse)
def emi_calculator(body: EmiRequest):
    """
    Calculate EMI (Equated Monthly Installment) for a loan.

    - principal: Loan amount
    - annual_interest_rate: Annual rate (e.g. 8.5 for 8.5%)
    - tenure_months: Loan tenure in months
    """
    return calculate_emi(
        principal=body.principal,
        annual_interest_rate=body.annual_interest_rate,
        tenure_months=body.tenure_months,
    )


@router.post("/compound", response_model=CompoundResponse)
def compound_calculator(body: CompoundRequest):
    """
    Calculate compound interest.

    - principal: Initial amount
    - annual_rate: Annual rate (e.g. 7 for 7%)
    - years: Duration
    - compounding_frequency: Times per year (default 12 = monthly)
    """
    return calculate_compound_interest(
        principal=body.principal,
        annual_rate=body.annual_rate,
        years=body.years,
        compounding_frequency=body.compounding_frequency,
    )
