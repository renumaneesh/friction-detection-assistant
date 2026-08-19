"""
test_ai_reasoning.py
--------------------
Unit tests for the Tier 2 AI Reasoning module.

Gemini API calls are fully mocked — no real API quota is consumed.
Run with:  python -m pytest backend/ai_reasoning/test_ai_reasoning.py -v
       or: python backend/ai_reasoning/test_ai_reasoning.py
"""

import json
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

# Standard session used for happy-path tests
PAYMENT_FRICTION_SESSION = {
    "session_id": "sess_123",
    "customer_id": "cust_456",
    "friction_flags": [
        {
            "type": "cart_abandoned",
            "confidence": 0.9,
            "signal": "added to cart, no purchase in 45 min",
        },
        {
            "type": "payment_friction",
            "confidence": 0.8,
            "signal": "2 failed payment attempts",
        },
    ],
    "product": {"name": "Wireless Earbuds Pro", "category": "Electronics", "price": 2499},
    "cart_value": 2499,
    "feedback_text": "payment kept failing, gave up",
}

# Session with only a cart-abandon flag (low-risk path)
CART_ABANDON_SESSION = {
    "session_id": "sess_789",
    "customer_id": "cust_001",
    "friction_flags": [
        {
            "type": "cart_abandoned",
            "confidence": 0.75,
            "signal": "added to cart, no purchase in 60 min",
        }
    ],
    "product": {"name": "Desk Lamp", "category": "Home", "price": 899},
    "cart_value": 899,
    "feedback_text": None,
}

# Delivery concern session
DELIVERY_CONCERN_SESSION = {
    "session_id": "sess_999",
    "customer_id": "cust_777",
    "friction_flags": [
        {
            "type": "delivery_concern",
            "confidence": 0.85,
            "signal": "viewed delivery info page 3 times",
        }
    ],
    "product": {"name": "Mini Fridge", "category": "Appliances", "price": 5400},
    "cart_value": 5400,
    "feedback_text": "not sure if it'll arrive before my trip",
}


# ---------------------------------------------------------------------------
# Helper — build a mock response object that .text returns JSON
# ---------------------------------------------------------------------------

def _mock_response(payload: dict) -> MagicMock:
    mock = MagicMock()
    mock.text = json.dumps(payload)
    return mock


# ---------------------------------------------------------------------------
# Tests for gemini_client.diagnose_friction
# ---------------------------------------------------------------------------

class TestDiagnoseFriction(unittest.TestCase):
    """Tests for diagnose_friction().  The Gemini API is always mocked."""

    # ------------------------------------------------------------------
    # Happy path: model returns a well-formed diagnosis
    # ------------------------------------------------------------------

    @patch("ai_reasoning.gemini_client._client")
    def test_happy_path_payment_friction(self, mock_client):
        """Payment-friction session → route_to_agent / high."""
        expected_diagnosis = {
            "likely_cause": (
                "The customer experienced repeated payment failures, "
                "likely due to a card or gateway issue rather than a change of mind."
            ),
            "recommended_action": "route_to_agent",
            "risk_tier": "high",
        }
        mock_client.models.generate_content.return_value = _mock_response(
            expected_diagnosis
        )

        from ai_reasoning import diagnose_friction

        result = diagnose_friction(PAYMENT_FRICTION_SESSION)

        self.assertEqual(result["recommended_action"], "route_to_agent")
        self.assertEqual(result["risk_tier"], "high")
        self.assertIn("likely_cause", result)
        self.assertIsInstance(result["likely_cause"], str)

    @patch("ai_reasoning.gemini_client._client")
    def test_happy_path_cart_abandon(self, mock_client):
        """Cart-abandon session → send_reminder_email / low."""
        expected_diagnosis = {
            "likely_cause": (
                "Customer added the item to cart but left without completing checkout, "
                "possibly due to price hesitation or distraction."
            ),
            "recommended_action": "send_reminder_email",
            "risk_tier": "low",
        }
        mock_client.models.generate_content.return_value = _mock_response(
            expected_diagnosis
        )

        from ai_reasoning import diagnose_friction

        result = diagnose_friction(CART_ABANDON_SESSION)

        self.assertEqual(result["recommended_action"], "send_reminder_email")
        self.assertEqual(result["risk_tier"], "low")

    @patch("ai_reasoning.gemini_client._client")
    def test_happy_path_delivery_concern(self, mock_client):
        """Delivery-concern session with feedback → send_faq_link / low."""
        expected_diagnosis = {
            "likely_cause": (
                "Customer is uncertain about delivery timing and is hesitant to "
                "purchase without confirmation it will arrive in time."
            ),
            "recommended_action": "send_faq_link",
            "risk_tier": "low",
        }
        mock_client.models.generate_content.return_value = _mock_response(
            expected_diagnosis
        )

        from ai_reasoning import diagnose_friction

        result = diagnose_friction(DELIVERY_CONCERN_SESSION)

        self.assertEqual(result["recommended_action"], "send_faq_link")
        self.assertEqual(result["risk_tier"], "low")

    # ------------------------------------------------------------------
    # Fallback: API raises an exception
    # ------------------------------------------------------------------

    @patch("ai_reasoning.gemini_client._client")
    def test_fallback_on_api_exception(self, mock_client):
        """Any API exception must return the safe fallback — never raise."""
        mock_client.models.generate_content.side_effect = Exception(
            "Simulated API timeout"
        )

        from ai_reasoning import diagnose_friction

        result = diagnose_friction(PAYMENT_FRICTION_SESSION)

        self.assertEqual(result["likely_cause"], "Unable to determine — flagged for manual review")
        self.assertEqual(result["recommended_action"], "route_to_agent")
        self.assertEqual(result["risk_tier"], "high")

    # ------------------------------------------------------------------
    # Fallback: model returns malformed / incomplete JSON
    # ------------------------------------------------------------------

    @patch("ai_reasoning.gemini_client._client")
    def test_fallback_on_missing_keys(self, mock_client):
        """Missing required keys in model output → safe fallback."""
        # Simulate model returning JSON that is missing 'risk_tier'
        bad_response = MagicMock()
        bad_response.text = json.dumps(
            {"likely_cause": "Something", "recommended_action": "send_faq_link"}
            # 'risk_tier' intentionally omitted
        )
        mock_client.models.generate_content.return_value = bad_response

        from ai_reasoning import diagnose_friction

        result = diagnose_friction(PAYMENT_FRICTION_SESSION)

        self.assertEqual(result["recommended_action"], "route_to_agent")
        self.assertEqual(result["risk_tier"], "high")

    @patch("ai_reasoning.gemini_client._client")
    def test_fallback_on_invalid_json(self, mock_client):
        """Non-JSON model output → safe fallback, no exception."""
        bad_response = MagicMock()
        bad_response.text = "Sorry, I cannot answer that."
        mock_client.models.generate_content.return_value = bad_response

        from ai_reasoning import diagnose_friction

        result = diagnose_friction(PAYMENT_FRICTION_SESSION)

        self.assertEqual(result["recommended_action"], "route_to_agent")
        self.assertEqual(result["risk_tier"], "high")


# ---------------------------------------------------------------------------
# Tests for revenue_score module
# ---------------------------------------------------------------------------

class TestCalculateRiskScore(unittest.TestCase):
    """Tests for calculate_risk_score() — no mocking needed (pure logic)."""

    def test_payment_friction_high_risk(self):
        """payment_friction (0.9) * 2499 * 1.2 = 2699.xx"""
        from ai_reasoning import calculate_risk_score

        diagnosis = {"risk_tier": "high"}
        score = calculate_risk_score(PAYMENT_FRICTION_SESSION, diagnosis)

        # Highest flag is payment_friction (0.9); high-risk multiplier 1.2
        expected = round(2499 * 0.9 * 1.2, 2)
        self.assertAlmostEqual(score, expected, places=2)

    def test_cart_abandon_low_risk(self):
        """cart_abandoned (0.6) * 899 — no high-risk multiplier."""
        from ai_reasoning import calculate_risk_score

        diagnosis = {"risk_tier": "low"}
        score = calculate_risk_score(CART_ABANDON_SESSION, diagnosis)

        expected = round(899 * 0.6, 2)
        self.assertAlmostEqual(score, expected, places=2)

    def test_unknown_friction_type_defaults_to_zero(self):
        """An unknown friction type produces weight 0 → score 0."""
        from ai_reasoning import calculate_risk_score

        session = {
            "cart_value": 1000,
            "friction_flags": [{"type": "unknown_type"}],
        }
        diagnosis = {"risk_tier": "low"}
        score = calculate_risk_score(session, diagnosis)

        self.assertEqual(score, 0.0)

    def test_empty_flags_produces_zero(self):
        from ai_reasoning import calculate_risk_score

        session = {"cart_value": 500, "friction_flags": []}
        diagnosis = {"risk_tier": "low"}
        score = calculate_risk_score(session, diagnosis)

        self.assertEqual(score, 0.0)

    def test_multiple_flags_uses_highest_weight(self):
        """When cart_abandoned and payment_friction both present, use 0.9."""
        from ai_reasoning import calculate_risk_score

        # Both flags present (same as PAYMENT_FRICTION_SESSION but low risk tier)
        diagnosis = {"risk_tier": "low"}
        score = calculate_risk_score(PAYMENT_FRICTION_SESSION, diagnosis)

        expected = round(2499 * 0.9, 2)  # payment_friction wins
        self.assertAlmostEqual(score, expected, places=2)


class TestAggregateRevenueAtRisk(unittest.TestCase):
    """Tests for aggregate_revenue_at_risk()."""

    def test_aggregate_two_sessions(self):
        from ai_reasoning import aggregate_revenue_at_risk, calculate_risk_score

        sessions = [
            {
                "session_data": PAYMENT_FRICTION_SESSION,
                "diagnosis": {"risk_tier": "high"},
            },
            {
                "session_data": CART_ABANDON_SESSION,
                "diagnosis": {"risk_tier": "low"},
            },
        ]
        result = aggregate_revenue_at_risk(sessions)

        score_1 = calculate_risk_score(PAYMENT_FRICTION_SESSION, {"risk_tier": "high"})
        score_2 = calculate_risk_score(CART_ABANDON_SESSION, {"risk_tier": "low"})

        self.assertAlmostEqual(result["total_revenue_at_risk"], score_1 + score_2, places=2)
        self.assertEqual(result["session_count"], 2)
        self.assertIsInstance(result["top_friction_cause"], str)

    def test_aggregate_output_shape(self):
        """Return dict must have exactly the three keys Tier 3 depends on."""
        from ai_reasoning import aggregate_revenue_at_risk

        result = aggregate_revenue_at_risk(
            [{"session_data": DELIVERY_CONCERN_SESSION, "diagnosis": {"risk_tier": "low"}}]
        )

        self.assertIn("total_revenue_at_risk", result)
        self.assertIn("session_count", result)
        self.assertIn("top_friction_cause", result)
        self.assertEqual(result["session_count"], 1)
        self.assertEqual(result["top_friction_cause"], "delivery_concern")

    def test_aggregate_empty_list(self):
        """Empty session list returns zero totals and 'unknown' cause."""
        from ai_reasoning import aggregate_revenue_at_risk

        result = aggregate_revenue_at_risk([])

        self.assertEqual(result["total_revenue_at_risk"], 0.0)
        self.assertEqual(result["session_count"], 0)
        self.assertEqual(result["top_friction_cause"], "unknown")


# ---------------------------------------------------------------------------
# Entry point for running directly (python test_ai_reasoning.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
