/**
 * sessions.routes.js
 * ------------------
 * New routes that wire the full pipeline:
 *   synthetic_data.json -> tier1Detection -> (only if flagged) geminiClient
 *   -> calculateRevenueAtRisk -> AtRiskSession shape
 *
 * Routes:
 *   GET /sessions/at-risk        -> all flagged sessions, fully diagnosed
 *   GET /sessions/:id/friction   -> single session, same pipeline
 *   GET /dashboard/summary       -> aggregate stats in RevenueAtRisk shape
 *
 * IMPORTANT: Gemini is NEVER called for sessions with zero friction flags.
 * This is enforced explicitly in runPipeline() — see the early-return guard.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { detectFrictionTier1 } = require('../services/tier1Detection');
const { diagnoseWithGemini } = require('../services/geminiClient');
const { calculateRevenueAtRisk } = require('../services/revenueRisk');
const dataLoader = require('../services/dataLoader');

// ---------------------------------------------------------------------------
// In-memory cache for /sessions/at-risk results
// { key: { data, timestamp } }  — key = limit value, TTL = 10 minutes
// ---------------------------------------------------------------------------
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function _cacheSet(key, data) {
  _cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Friction type vocabulary: synthetic data uses these names.
// Frontend FrictionBadge / SessionsTable filter on these exact strings.
// tier1Detection.js uses different names internally; we map on output.
// ---------------------------------------------------------------------------

const TIER1_TYPE_TO_FRONTEND = {
  payment_failure:        'payment_friction',
  cart_abandonment:       'cart_abandoned',
  step_dropoff:           'cart_abandoned',
  time_on_page_exceeded:  'hesitation',
  rage_clicks:            'hesitation',
  promo_loop:             'hesitation',
  ambiguous_friction:     'hesitation',
  none:                   null,
};

/**
 * Map a tier1 detection result to the frontend FrictionFlag shape.
 * Returns null for un-flagged sessions.
 */
function buildFrictionFlags(tier1Result) {
  if (!tier1Result.detected || tier1Result.type === 'none') return [];

  const allDetections = tier1Result.allDetections || [tier1Result];
  const flags = [];

  for (const detection of allDetections) {
    const frontendType = TIER1_TYPE_TO_FRONTEND[detection.type];
    if (!frontendType) continue;

    // Avoid duplicate types from multiple detectors
    if (flags.some((f) => f.type === frontendType)) continue;

    flags.push({
      type:       frontendType,
      confidence: detection.confidence || 0,
      signal:     detection.reason || detection.matchedSignals?.join('; ') || '',
    });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Core pipeline function — shared by both route handlers
// ---------------------------------------------------------------------------

/**
 * Run the full Tier1 -> (conditional) Gemini -> risk score pipeline for one session.
 *
 * Gemini is called ONLY when tier1Result.detected === true.
 * Zero-flag sessions get a fallback diagnosis and are excluded from the at-risk list.
 *
 * @param {Object} rawSession - Session object from synthetic_data.json
 * @param {Object} [opts]
 * @param {boolean} [opts.includeNotFlagged=false] - If true, include sessions with no flags
 * @returns {Promise<Object|null>} AtRiskSession-shaped object, or null if not at-risk
 */
async function runPipeline(rawSession, { includeNotFlagged = false } = {}) {
  const product = dataLoader.deriveSessionProduct(rawSession);
  const cartValue = dataLoader.deriveCartValue(rawSession, product);
  const customer = dataLoader.getCustomerById(rawSession.customer_id) || {};

  // Adapt events to tier1Detection's expected field names
  const adaptedEvents = dataLoader.adaptEventsForTier1(rawSession.events);

  // Build session context for tier1
  const sessionCtx = {
    sessionId: rawSession.id,
    cartValue,
    status: rawSession.ended_at ? 'ended' : 'active',
  };

  // --- Tier 1 ---
  const tier1Result = detectFrictionTier1(sessionCtx, adaptedEvents);

  // ⚡ COST EFFICIENCY GATE: Gemini is NEVER called if no friction detected
  if (!tier1Result.detected) {
    if (!includeNotFlagged) return null; // Exclude from at-risk list
    // Return minimal shape for completeness (non-at-risk sessions)
    return null;
  }

  const frictionFlags = buildFrictionFlags(tier1Result);
  if (frictionFlags.length === 0) return null;

  // --- Tier 3 (Gemini) — only reached if tier1 flagged the session ---
  const geminiInput = {
    friction_flags: frictionFlags,
    product,
    cart_value: cartValue,
    feedback_text: rawSession.feedback ? rawSession.feedback.text : null,
  };
  const diagnosis = await diagnoseWithGemini(geminiInput);

  // --- Risk score: normalize to 0-1 using JS revenueRisk formula ---
  // revenueRisk.calculateRevenueAtRisk uses the JS type names (e.g. payment_failure)
  // so we pass the raw tier1 type, not the remapped frontend type.
  const rawRisk = calculateRevenueAtRisk({
    cartValue,
    type: tier1Result.type,
    confidence: tier1Result.confidence,
  });
  // Normalise to 0-1 range (divide by cartValue, fallback to tier1 confidence)
  const riskScore = cartValue > 0
    ? Math.min(1.0, rawRisk / cartValue)
    : (tier1Result.confidence || 0);

  return {
    session_id:          rawSession.id,
    customer_id:         rawSession.customer_id,
    customer_name:       customer.name || rawSession.customer_id,
    friction_flags:      frictionFlags,
    product,
    cart_value:          cartValue,
    feedback_text:       rawSession.feedback ? rawSession.feedback.text : null,
    likely_cause:        diagnosis.likely_cause,
    recommended_action:  diagnosis.recommended_action,
    risk_tier:           diagnosis.risk_tier,
    risk_score:          parseFloat(riskScore.toFixed(4)),
    timestamp:           rawSession.started_at,
  };
}

// ---------------------------------------------------------------------------
// GET /sessions/at-risk
// ---------------------------------------------------------------------------

router.get('/sessions/at-risk', async (req, res, next) => {
  try {
    // ?limit param — default 15 for fast demo loads, max 300
    const limit = Math.min(parseInt(req.query.limit, 10) || 15, 300);
    const cacheKey = `at-risk-${limit}`;

    // Serve from cache if available (instant on repeat loads)
    const cached = _cacheGet(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const allSessions = dataLoader.getAllSessions();

    // Two-pass: Tier 1 is free (no Gemini), run across all 300 to find flagged ones.
    // Collect flagged sessions first, then run Gemini only on up to `limit` of them.
    const flaggedSessions = [];
    for (const s of allSessions) {
      const product   = dataLoader.deriveSessionProduct(s);
      const cartValue = dataLoader.deriveCartValue(s, product);
      const adapted   = dataLoader.adaptEventsForTier1(s.events);
      const t1        = detectFrictionTier1({ sessionId: s.id, cartValue }, adapted);
      if (t1.detected) flaggedSessions.push({ session: s, type: t1.type });
    }

    // Stratify by friction type for the demo so we don't just get 15 of the same type
    const byType = {};
    for (const item of flaggedSessions) {
      if (!byType[item.type]) byType[item.type] = [];
      byType[item.type].push(item.session);
    }

    const toProcess = [];
    let idx = 0;
    while (toProcess.length < limit && toProcess.length < flaggedSessions.length) {
      for (const type of Object.keys(byType)) {
        if (byType[type].length > idx) {
          toProcess.push(byType[type][idx]);
          if (toProcess.length === limit) break;
        }
      }
      idx++;
    }

    // Run Gemini pipeline in batches of 5 (rate-limit friendly)
    const BATCH_SIZE = 5;
    const atRiskSessions = [];
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((s) => runPipeline(s)));
      for (const r of results) {
        if (r !== null) atRiskSessions.push(r);
      }
    }

    // Sort by risk_score descending (highest risk first)
    atRiskSessions.sort((a, b) => b.risk_score - a.risk_score);

    // Store in cache
    _cacheSet(cacheKey, atRiskSessions);

    res.setHeader('X-Cache', 'MISS');
    res.json(atRiskSessions);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /sessions/:id/friction
// ---------------------------------------------------------------------------

router.get('/sessions/:id/friction', async (req, res, next) => {
  try {
    const session = dataLoader.getSessionById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { message: `Session not found: ${req.params.id}` },
      });
    }

    const result = await runPipeline(session, { includeNotFlagged: false });

    if (!result) {
      return res.json({
        session_id:       session.id,
        friction_flags:   [],
        likely_cause:     'No friction detected for this session.',
        recommended_action: 'send_reminder_email',
        risk_tier:        'low',
        risk_score:       0,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard/summary
// Aggregate stats in the RevenueAtRisk shape the frontend types.ts defines:
// { total_revenue_at_risk, session_count, top_friction_cause }
// ---------------------------------------------------------------------------

router.get('/dashboard/summary', async (req, res, next) => {
  try {
    const allSessions = dataLoader.getAllSessions();

    // Run tier1 only (no Gemini) for summary — fast and cost-free
    const BATCH_SIZE = 20;
    const flaggedSummaries = [];

    for (let i = 0; i < allSessions.length; i += BATCH_SIZE) {
      const batch = allSessions.slice(i, i + BATCH_SIZE);
      for (const rawSession of batch) {
        const product   = dataLoader.deriveSessionProduct(rawSession);
        const cartValue = dataLoader.deriveCartValue(rawSession, product);
        const adapted   = dataLoader.adaptEventsForTier1(rawSession.events);
        const t1        = detectFrictionTier1({ sessionId: rawSession.id, cartValue }, adapted);

        if (t1.detected) {
          const rawRisk = calculateRevenueAtRisk({ cartValue, type: t1.type });
          flaggedSummaries.push({ riskDollars: rawRisk, type: t1.type });
        }
      }
    }

    // Build the flat RevenueAtRisk summary shape
    const total_revenue_at_risk = flaggedSummaries.reduce(
      (sum, s) => sum + s.riskDollars, 0
    );

    // Count friction types (using mapped frontend names for consistency)
    const typeCounts = {};
    for (const s of flaggedSummaries) {
      const frontendType = TIER1_TYPE_TO_FRONTEND[s.type] || s.type;
      typeCounts[frontendType] = (typeCounts[frontendType] || 0) + 1;
    }
    const top_friction_cause = Object.keys(typeCounts).length > 0
      ? Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0]
      : 'cart_abandoned';

    res.json({
      total_revenue_at_risk: parseFloat(total_revenue_at_risk.toFixed(2)),
      session_count:         flaggedSummaries.length,
      top_friction_cause,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
