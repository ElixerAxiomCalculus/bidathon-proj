"""
SIP Calculator — Systematic Investment Plan returns.
"""


def calculate_sip(
    monthly_investment: float,
    annual_return_rate: float,
    years: int,
) -> dict:
    """
    Calculate SIP maturity value using the compound-interest formula:
        FV = P × [((1+r)^n - 1) / r] × (1+r)
    where P = monthly investment, r = monthly rate, n = total months.
    """
    monthly_rate = (annual_return_rate / 100) / 12
    total_months = years * 12
    total_invested = monthly_investment * total_months

    if monthly_rate == 0:
        total_value = total_invested
    else:
        total_value = monthly_investment * (
            (((1 + monthly_rate) ** total_months) - 1) / monthly_rate
        ) * (1 + monthly_rate)

    estimated_returns = total_value - total_invested

    return {
        "monthly_investment": monthly_investment,
        "annual_return_rate": annual_return_rate,
        "years": years,
        "total_months": total_months,
        "total_invested": round(total_invested, 2),
        "estimated_returns": round(estimated_returns, 2),
        "total_value": round(total_value, 2),
    }
