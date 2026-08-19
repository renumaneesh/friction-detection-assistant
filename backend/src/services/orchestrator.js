const { detectFrictionTier1 } = require('./tier1Detection');
const { diagnoseFriction } = require('./tier3Stub');
const { calculateRevenueAtRisk } = require('./revenueRisk');
const FrictionEvent = require('../models/FrictionEvent');
const env = require('../config/env');
const mongoose = require('mongoose');

// In-memory metrics tracking for live demo & cost efficiency reporting
const cascadeMetrics = {
  totalSessionsAnalyzed: 0,
  resolvedAtTier1Count: 0,
  escalatedToTier3Count: 0,
  totalEstimatedLlmCostSaved: 0.0,
  costPerLlmCallUsd: 0.03, // Average cost per LLM call saved
  frictionEventsStore: [], // Fallback in-memory store when DB is un-connected
};

/**
 * Reset cascade metrics (useful for testing)
 */
function resetCascadeMetrics() {
  cascadeMetrics.totalSessionsAnalyzed = 0;
  cascadeMetrics.resolvedAtTier1Count = 0;
  cascadeMetrics.escalatedToTier3Count = 0;
  cascadeMetrics.totalEstimatedLlmCostSaved = 0.0;
  cascadeMetrics.frictionEventsStore = [];
}

/**
 * Get live cost efficiency metrics
 */
function getCostEfficiencyMetrics() {
  const total = cascadeMetrics.totalSessionsAnalyzed;
  const tier1 = cascadeMetrics.resolvedAtTier1Count;
  const tier3 = cascadeMetrics.escalatedToTier3Count;
  const tier1Percentage = total > 0 ? Number(((tier1 / total) * 100).toFixed(2)) : 0;
  const tier3Percentage = total > 0 ? Number(((tier3 / total) * 100).toFixed(2)) : 0;

  return {
    totalSessionsAnalyzed: total,
    resolvedAtTier1Count: tier1,
    escalatedToTier3Count: tier3,
    tier1ResolutionPercentage: tier1Percentage,
    tier3EscalationPercentage: tier3Percentage,
    estimatedLlmCostSavedUsd: Number(cascadeMetrics.totalEstimatedLlmCostSaved.toFixed(2)),
  };
}

/**
 * Core Cascade Orchestration logic
 * @param {Object} session - Session object ({ sessionId, cartValue, status, ... })
 * @param {Array} events - Stream of customer events
 * @param {Object} options - Override thresholds ({ confidenceThreshold, highValueThreshold })
 */
async function orchestrateFrictionCascade(session, events = [], options = {}) {
  cascadeMetrics.totalSessionsAnalyzed += 1;

  const confidenceThreshold = options.confidenceThreshold || env.TIER1_CONFIDENCE_THRESHOLD || 0.75;
  const highValueThreshold = options.highValueThreshold || env.HIGH_RISK_CART_VALUE_THRESHOLD || 100;
  const cartValue = session?.cartValue || 0;

  // Step 1: Run Tier 1 rule-based detection
  const tier1Result = detectFrictionTier1(session, events, options);

  let finalFrictionResult = null;
  let detectedBy = 'tier1';

  // Decision boundary condition for Tier 1 action vs Tier 3 escalation:
  // Tier 1 direct action requires:
  // 1. Friction was detected
  // 2. Tier 1 confidence >= threshold
  // 3. Cart value <= highValueThreshold (high-value carts get escalated to Tier 3 for deep analysis)
  const isHighConfidence = tier1Result.detected && tier1Result.confidence >= confidenceThreshold;
  const isHighValueCart = cartValue > highValueThreshold;
  const isAmbiguousOrNovel = !tier1Result.detected || tier1Result.confidence < confidenceThreshold;

  if (isHighConfidence && !isHighValueCart) {
    // RESOLVED AT TIER 1
    detectedBy = 'tier1';
    cascadeMetrics.resolvedAtTier1Count += 1;
    cascadeMetrics.totalEstimatedLlmCostSaved += cascadeMetrics.costPerLlmCallUsd;

    finalFrictionResult = {
      sessionId: session.sessionId,
      type: tier1Result.type,
      detectedBy: 'tier1',
      confidence: tier1Result.confidence,
      reason: tier1Result.reason,
      matchedSignals: tier1Result.matchedSignals,
      aiDiagnosis: null,
    };
  } else {
    // ESCALATE TO TIER 3 (LLM REASONING)
    detectedBy = 'tier3';
    cascadeMetrics.escalatedToTier3Count += 1;

    const sessionContext = {
      sessionId: session.sessionId,
      userId: session.userId,
      cartValue,
      events,
      tier1Result,
      escalationReason: isHighValueCart
        ? `High cart value ($${cartValue} > $${highValueThreshold})`
        : `Ambiguous/novel friction (Tier 1 confidence: ${tier1Result.confidence})`,
    };

    const tier3Diagnosis = await diagnoseFriction(sessionContext);

    finalFrictionResult = {
      sessionId: session.sessionId,
      type: tier3Diagnosis.type || tier1Result.type || 'ambiguous_friction',
      detectedBy: 'tier3',
      confidence: tier3Diagnosis.confidence || 0.85,
      reason: tier3Diagnosis.explanation || 'Escalated to Tier 3 AI Reasoning',
      matchedSignals: tier3Diagnosis.explainabilityTrail || tier1Result.matchedSignals || [],
      aiDiagnosis: tier3Diagnosis,
    };
  }

  // Calculate Revenue at Risk
  const revenueAtRisk = calculateRevenueAtRisk({
    cartValue,
    type: finalFrictionResult.type,
    confidence: finalFrictionResult.confidence,
  });
  finalFrictionResult.revenueAtRisk = revenueAtRisk;

  // Persist Friction Event (to Mongoose DB if connected, or memory fallback)
  let savedDoc = null;
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      savedDoc = await FrictionEvent.create({
        sessionId: finalFrictionResult.sessionId,
        type: finalFrictionResult.type,
        detectedBy: finalFrictionResult.detectedBy,
        confidence: finalFrictionResult.confidence,
        reason: finalFrictionResult.reason,
        revenueAtRisk: finalFrictionResult.revenueAtRisk,
        aiDiagnosis: finalFrictionResult.aiDiagnosis,
        status: 'detected',
      });
    }
  } catch (err) {
    console.warn('[Orchestrator] Database write skipped/failed, using in-memory store:', err.message);
  }

  if (!savedDoc) {
    savedDoc = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...finalFrictionResult,
      status: 'detected',
      createdAt: new Date(),
    };
  }

  cascadeMetrics.frictionEventsStore.push(savedDoc);

  return {
    frictionEvent: savedDoc,
    cascadeDecision: {
      detectedBy,
      escalated: detectedBy === 'tier3',
      tier1Confidence: tier1Result.confidence,
      cartValue,
      metrics: getCostEfficiencyMetrics(),
    },
  };
}

module.exports = {
  orchestrateFrictionCascade,
  getCostEfficiencyMetrics,
  resetCascadeMetrics,
  cascadeMetrics,
};
