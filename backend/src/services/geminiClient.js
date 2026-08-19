/**
 * geminiClient.js
 * ---------------
 * Faithful JS port of backend/ai_reasoning/gemini_client.py
 *
 * Calls Gemini ONLY on sessions already flagged by Tier 1 (rule engine).
 * Processes ONE session per call — looping is the API layer's job.
 * Never throws — returns safe fallback object on any failure.
 */

'use strict';

const { GoogleGenAI } = require('@google/genai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// ---------------------------------------------------------------------------
// Configuration — matches gemini_client.py exactly
// ---------------------------------------------------------------------------

const _API_KEY = process.env.GEMINI_API_KEY || '';
const _client = _API_KEY ? new GoogleGenAI({ apiKey: _API_KEY }) : null;

const _MODEL_NAME = 'gemini-3.6-flash';

// ---------------------------------------------------------------------------
// System prompt — copied verbatim from gemini_client.py, JS template literal only
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
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
`;

// ---------------------------------------------------------------------------
// Response schema — mirrors _RESPONSE_SCHEMA in gemini_client.py exactly
// ---------------------------------------------------------------------------

const _RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    likely_cause: {
      type: 'string',
      description: '1-2 plain-English sentences describing the likely underlying cause.',
    },
    recommended_action: {
      type: 'string',
      enum: ['send_reminder_email', 'offer_discount', 'route_to_agent', 'send_faq_link'],
    },
    risk_tier: {
      type: 'string',
      enum: ['low', 'high'],
    },
  },
  required: ['likely_cause', 'recommended_action', 'risk_tier'],
};

// ---------------------------------------------------------------------------
// Safe fallback — returned on any failure, mirrors _FALLBACK_RESPONSE in .py
// ---------------------------------------------------------------------------

const _FALLBACK_RESPONSE = {
  likely_cause: 'Unable to determine — flagged for manual review',
  recommended_action: 'route_to_agent',
  risk_tier: 'high',
};

// ---------------------------------------------------------------------------
// Public API — mirrors diagnose_friction() in gemini_client.py
// ---------------------------------------------------------------------------

/**
 * Analyse a single flagged session and return a structured diagnosis.
 *
 * @param {Object} sessionData - Must contain at minimum `friction_flags`,
 *   `product`, and `cart_value`. `feedback_text` may be null or absent.
 * @returns {Promise<{likely_cause: string, recommended_action: string, risk_tier: string}>}
 *   Never rejects — returns safe fallback on any failure.
 */
async function diagnoseWithGemini(sessionData) {
  try {
    if (!_client) {
      // No API key configured — return fallback immediately (mirrors py behaviour)
      return { ..._FALLBACK_RESPONSE };
    }

    const userMessage = JSON.stringify(sessionData, null, 2);

    const response = await _client.models.generateContent({
      model: _MODEL_NAME,
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: _RESPONSE_SCHEMA,
      },
    });

    const rawText = (response.text || '').trim();
    const diagnosis = JSON.parse(rawText);

    // Validate required keys are present (mirrors Python validation)
    const required = ['likely_cause', 'recommended_action', 'risk_tier'];
    if (!required.every((k) => k in diagnosis)) {
      return { ..._FALLBACK_RESPONSE };
    }

    return diagnosis;
  } catch (_err) {
    // Intentional broad catch — never throw (mirrors py `except Exception`)
    return { ..._FALLBACK_RESPONSE };
  }
}

module.exports = { diagnoseWithGemini, SYSTEM_PROMPT, _FALLBACK_RESPONSE };
