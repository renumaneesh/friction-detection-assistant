const RecoveryAction = require('../models/RecoveryAction');
const mongoose = require('mongoose');

// In-memory fallback store for recovery actions when DB is offline
const recoveryActionsStore = [];

/**
 * Route a recovery action based on friction risk level
 *
 * @param {Object} params - { frictionEvent, session }
 * @returns {Promise<Object>} Created RecoveryAction
 */
async function routeRecoveryAction({ frictionEvent, session }) {
  const cartValue = session?.cartValue || 0;
  const isTier3 = frictionEvent.detectedBy === 'tier3';
  const isHighValue = cartValue > 100;
  const isPaymentFailure = frictionEvent.type === 'payment_failure';

  // High risk criteria: High cart value, Tier 3 escalation, or payment failures needing human touch
  const isHighRisk = isHighValue || isTier3 || isPaymentFailure;
  const riskLevel = isHighRisk ? 'high' : 'low';

  const actionType = isHighRisk
    ? 'human_escalation'
    : frictionEvent.aiDiagnosis?.suggestedAction || 'auto_recovery_nudge';

  const status = isHighRisk ? 'pending' : 'auto_executed';

  const explainability = [
    `Friction type: ${frictionEvent.type}`,
    `Detected by: ${frictionEvent.detectedBy}`,
    `Confidence score: ${frictionEvent.confidence}`,
    `Cart value: $${cartValue}`,
    ...(frictionEvent.matchedSignals || []),
  ];

  const draftedResponse = frictionEvent.aiDiagnosis?.explanation || frictionEvent.reason;

  let recoveryDoc = null;
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      recoveryDoc = await RecoveryAction.create({
        frictionEventId: frictionEvent._id || new mongoose.Types.ObjectId(),
        sessionId: frictionEvent.sessionId,
        actionType,
        riskLevel,
        status,
        explainability,
        draftedResponse,
      });
    }
  } catch (err) {
    console.warn('[AutomationRouter] DB write skipped/failed, using in-memory store:', err.message);
  }

  if (!recoveryDoc) {
    recoveryDoc = {
      _id: new mongoose.Types.ObjectId().toString(),
      frictionEventId: frictionEvent._id || new mongoose.Types.ObjectId().toString(),
      sessionId: frictionEvent.sessionId,
      actionType,
      riskLevel,
      status,
      explainability,
      draftedResponse,
      createdAt: new Date(),
    };
  }

  recoveryActionsStore.push(recoveryDoc);

  return recoveryDoc;
}

/**
 * Get all pending human escalation actions
 */
async function getPendingHumanEscalations() {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const dbActions = await RecoveryAction.find({ status: 'pending', riskLevel: 'high' }).lean();
      if (dbActions.length > 0) return dbActions;
    }
  } catch (err) {
    console.warn('[AutomationRouter] DB query failed, falling back to memory store:', err.message);
  }

  return recoveryActionsStore.filter((a) => a.status === 'pending' && a.riskLevel === 'high');
}

/**
 * Human resolution of a pending escalation (Approve or Reject)
 *
 * @param {String} actionId - ID of RecoveryAction
 * @param {Object} resolution - { decision: 'approved' | 'rejected', notes }
 */
async function resolveHumanEscalation(actionId, { decision, notes }) {
  const newStatus = decision === 'approved' ? 'approved' : 'rejected';

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const updated = await RecoveryAction.findByIdAndUpdate(
        actionId,
        { status: newStatus, $push: { explainability: `Human resolution: ${decision} (${notes || 'No notes'})` } },
        { new: true }
      ).lean();
      if (updated) return updated;
    }
  } catch (err) {
    console.warn('[AutomationRouter] DB update failed, resolving in memory:', err.message);
  }

  const memIndex = recoveryActionsStore.findIndex((a) => a._id.toString() === actionId.toString());
  if (memIndex !== -1) {
    recoveryActionsStore[memIndex].status = newStatus;
    recoveryActionsStore[memIndex].explainability.push(`Human resolution: ${decision} (${notes || 'No notes'})`);
    return recoveryActionsStore[memIndex];
  }

  throw new Error(`RecoveryAction not found with ID: ${actionId}`);
}

module.exports = {
  routeRecoveryAction,
  getPendingHumanEscalations,
  resolveHumanEscalation,
  recoveryActionsStore,
};
