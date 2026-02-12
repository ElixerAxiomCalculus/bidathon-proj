"""
EMI Calculator — Equated Monthly Installment for loans.
"""


def calculate_emi(
    principal: float,
    annual_interest_rate: float,
    tenure_months: int,
) -> dict:
    """
    Calculate EMI using the standard formula:
        EMI = P × r × (1+r)^n / ((1+r)^n - 1)
    where P = principal, r = monthly rate, n = tenure in months.
    """
    monthly_rate = (annual_interest_rate / 100) / 12

    if monthly_rate == 0:
        emi = principal / tenure_months
    else:
        emi = principal * monthly_rate * (
            (1 + monthly_rate) ** tenure_months
        ) / (((1 + monthly_rate) ** tenure_months) - 1)

    total_payment = emi * tenure_months
    total_interest = total_payment - principal

    return {
        "principal": principal,
        "annual_interest_rate": annual_interest_rate,
        "tenure_months": tenure_months,
        "emi": round(emi, 2),
        "total_payment": round(total_payment, 2),
        "total_interest": round(total_interest, 2),
    }
