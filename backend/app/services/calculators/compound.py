"""
Compound Interest Calculator.
"""


def calculate_compound_interest(
    principal: float,
    annual_rate: float,
    years: int,
    compounding_frequency: int = 12,
) -> dict:
    """
    Calculate compound interest.
        A = P × (1 + r/n)^(n×t)
    where P = principal, r = annual rate, n = frequency, t = years.
    """
    r = annual_rate / 100
    n = compounding_frequency
    t = years

    final_amount = principal * ((1 + r / n) ** (n * t))
    interest_earned = final_amount - principal

    # Effective annual rate
    effective_annual_rate = ((1 + r / n) ** n - 1) * 100

    return {
        "principal": principal,
        "annual_rate": annual_rate,
        "years": years,
        "compounding_frequency": compounding_frequency,
        "final_amount": round(final_amount, 2),
        "interest_earned": round(interest_earned, 2),
        "effective_annual_rate": round(effective_annual_rate, 2),
    }
