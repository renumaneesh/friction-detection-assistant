"""
revenue_score.py
----------------
Tier 2 AI Reasoning: Revenue-at-risk scoring.

Converts a Tier 1 session + Tier 2 diagnosis into a numeric risk score,
and aggregates across sessions for dashboard summary cards.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Severity weights per friction type
# ---------------------------------------------------------------------------

_SEVERITY_WEIGHTS: dict[str, float] = {
    "payment_friction": 0.9,
    "delivery_concern": 0.5,
    "cart_abandoned": 0.6,
    "hesitation": 0.3,
}

# Multiplier applied when the AI diagnosis classifies the session as high-risk
_HIGH_RISK_MULTIPLIER: float = 1.2


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def calculate_risk_score(session_data: dict, diagnosis: dict) -> float:
    """Compute the revenue-at-risk score for a single flagged session.

    Formula:
        risk_score = cart_value * severity_weight
        If diagnosis["risk_tier"] == "high": risk_score *= 1.2

    The severity_weight is the highest weight among all friction flags
    present in the session.  Unknown friction types default to 0.0.

    Args:
        session_data: Tier 1 session payload (must contain ``cart_value``
            and ``friction_flags``).
        diagnosis:    Tier 2 diagnosis dict (must contain ``risk_tier``).

    Returns:
        A non-negative float representing the estimated revenue at risk.
    """
    cart_value: float = float(session_data.get("cart_value", 0))

    friction_flags: list[dict] = session_data.get("friction_flags", [])
    severity_weight: float = max(
        (_SEVERITY_WEIGHTS.get(flag.get("type", ""), 0.0) for flag in friction_flags),
        default=0.0,
    )

    risk_score: float = cart_value * severity_weight

    if diagnosis.get("risk_tier") == "high":
        risk_score *= _HIGH_RISK_MULTIPLIER

    return round(risk_score, 2)


def aggregate_revenue_at_risk(sessions: list[dict]) -> dict:
    """Aggregate risk scores across multiple sessions for dashboard summary cards.

    Each item in ``sessions`` must be a dict with keys:
        - ``session_data``: the Tier 1 session payload
        - ``diagnosis``:    the Tier 2 diagnosis dict

    Returns:
        {
            "total_revenue_at_risk": float,   # sum of all risk scores
            "session_count":         int,     # number of sessions processed
            "top_friction_cause":    str,     # most frequent friction type
        }

    This output shape is fixed — Tier 3 dashboard cards depend on it.
    """
    total: float = 0.0
    friction_type_counts: dict[str, int] = {}

    for item in sessions:
        session_data: dict = item.get("session_data", {})
        diagnosis: dict = item.get("diagnosis", {})

        total += calculate_risk_score(session_data, diagnosis)

        for flag in session_data.get("friction_flags", []):
            friction_type = flag.get("type", "unknown")
            friction_type_counts[friction_type] = (
                friction_type_counts.get(friction_type, 0) + 1
            )

    top_friction_cause: str = (
        max(friction_type_counts, key=friction_type_counts.__getitem__)
        if friction_type_counts
        else "unknown"
    )

    return {
        "total_revenue_at_risk": round(total, 2),
        "session_count": len(sessions),
        "top_friction_cause": top_friction_cause,
    }
