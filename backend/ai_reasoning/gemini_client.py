"""
gemini_client.py
----------------
Tier 2 AI Reasoning: Gemini-based friction diagnosis.

Called ONLY on sessions already flagged by Tier 1 (rule engine).
This module processes ONE session per call — looping over sessions is the
responsibility of the upstream API layer, not this module.
"""

import json
import os

from google import genai
from google.genai import types
from dotenv import load_dotenv, find_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# find_dotenv() walks up from this file's location until it finds a .env,
# so the key is loaded correctly regardless of where Python is invoked from.
load_dotenv(find_dotenv(usecwd=False))

_API_KEY = os.environ.get("GEMINI_API_KEY", "")
_client = genai.Client(api_key=_API_KEY) if _API_KEY else None

_MODEL_NAME = "gemini-3.6-flash"

# ---------------------------------------------------------------------------
# System prompt (verbatim — do not edit)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """
You are a customer journey friction analyst for an e-commerce platform. 
You will be given structured data about a customer session that has already 
been flagged as showing friction by a rule-based detection system. Your job 
is NOT to detect friction — that's already done. Your job is to:
1. Explain the LIKELY underlying cause in plain, business-readable English.
2. Recommend exactly one recovery action from a fixed set.
3. Classify the risk tier for automation purposes.

Rules:
- Base your reasoning only on the provided signals, product info, and 
  feedback text. Do not invent details not present in the input.
- likely_cause must be 1-2 sentences, written for a non-technical business 
  user (e.g. a marketing manager), not a data scientist.
- recommended_action must be exactly one of: send_reminder_email, 
  offer_discount, route_to_agent, send_faq_link.
- risk_tier: use "low" only for send_reminder_email or send_faq_link. 
  Use "high" for offer_discount or route_to_agent (these need human approval 
  since they involve cost or direct customer contact).
- If feedback_text is present and clearly explains the issue, prioritize 
  that over inferring from flags alone.
- If multiple friction flags are present, address the most severe one 
  (payment_friction > delivery_concern > cart_abandoned > hesitation).

Examples:

Input: {"friction_flags": [{"type": "payment_friction", "signal": "2 failed 
payment attempts"}], "product": {"name": "Running Shoes", "price": 3200}, 
"feedback_text": null}
Output: {"likely_cause": "Customer attempted payment twice unsuccessfully, 
likely a card or gateway issue rather than a change of mind.", 
"recommended_action": "route_to_agent", "risk_tier": "high"}

Input: {"friction_flags": [{"type": "cart_abandoned", "signal": "added to 
cart, no purchase in 45 min"}], "product": {"name": "Desk Lamp", "price": 
899}, "feedback_text": null}
Output: {"likely_cause": "Customer added the item to cart but left without 
completing checkout, possibly due to price hesitation or distraction.", 
"recommended_action": "send_reminder_email", "risk_tier": "low"}

Input: {"friction_flags": [{"type": "delivery_concern", "signal": "viewed 
delivery info page 3 times"}], "product": {"name": "Mini Fridge", "price": 
5400}, "feedback_text": "not sure if it'll arrive before my trip"}
Output: {"likely_cause": "Customer is uncertain about delivery timing and 
is hesitant to purchase without confirmation it will arrive in time.", 
"recommended_action": "send_faq_link", "risk_tier": "low"}

Return ONLY valid JSON matching the required schema. No extra text.
"""

# ---------------------------------------------------------------------------
# Response schema enforced by the Gemini API
# ---------------------------------------------------------------------------

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "likely_cause": {
            "type": "string",
            "description": "1-2 plain-English sentences describing the likely underlying cause.",
        },
        "recommended_action": {
            "type": "string",
            "enum": [
                "send_reminder_email",
                "offer_discount",
                "route_to_agent",
                "send_faq_link",
            ],
        },
        "risk_tier": {
            "type": "string",
            "enum": ["low", "high"],
        },
    },
    "required": ["likely_cause", "recommended_action", "risk_tier"],
}

# ---------------------------------------------------------------------------
# Safe fallback — returned whenever anything goes wrong
# ---------------------------------------------------------------------------

_FALLBACK_RESPONSE: dict = {
    "likely_cause": "Unable to determine — flagged for manual review",
    "recommended_action": "route_to_agent",
    "risk_tier": "high",
}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def diagnose_friction(session_data: dict) -> dict:
    """Analyse a single flagged session and return a structured diagnosis.

    Args:
        session_data: The payload produced by Tier 1 (rule engine).  Must
            contain at minimum ``friction_flags``, ``product``, and
            ``cart_value``.  ``feedback_text`` may be ``None`` or absent.

    Returns:
        A dict with keys ``likely_cause`` (str), ``recommended_action`` (str),
        and ``risk_tier`` (str).  This function **never raises** — on any
        failure it returns the safe fallback response.
    """
    try:
        if _client is None:
            # No API key configured — return fallback immediately
            return dict(_FALLBACK_RESPONSE)

        # Build a focused user message from the session payload
        user_message = json.dumps(session_data, ensure_ascii=False, indent=2)

        response = _client.models.generate_content(
            model=_MODEL_NAME,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
            ),
        )

        # Extract and parse the JSON text returned by the model
        raw_text = response.text.strip()
        diagnosis = json.loads(raw_text)

        # Validate the three required keys are present
        required_keys = {"likely_cause", "recommended_action", "risk_tier"}
        if not required_keys.issubset(diagnosis.keys()):
            return dict(_FALLBACK_RESPONSE)

        return diagnosis

    except Exception:  # noqa: BLE001 — intentional broad catch for reliability
        return dict(_FALLBACK_RESPONSE)
