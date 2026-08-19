"""
ai_reasoning package
--------------------
Public surface of the Tier 2 AI reasoning module.

Usage from other backend packages:
    from ai_reasoning import diagnose_friction
    from ai_reasoning import calculate_risk_score, aggregate_revenue_at_risk
"""

from .gemini_client import diagnose_friction
from .revenue_score import aggregate_revenue_at_risk, calculate_risk_score

__all__ = [
    "diagnose_friction",
    "calculate_risk_score",
    "aggregate_revenue_at_risk",
]
