/**
 * Tier 3 LLM Reasoning Module (Stub / Mock Interface Contract)
 * Real module (AI Lead) will replace this file's implementation only.
 * Function signature is the contract — do not change it without syncing with AI Lead.
 *
 * @param {Object} sessionContext - { sessionId, userId, cartValue, events: [...], tier1Result }
 * @returns {Promise<Object>} - { type, confidence, explanation, suggestedAction, explainabilityTrail: [...] }
 */
async function diagnoseFriction(sessionContext) {
  const { sessionId, cartValue = 0, events = [], tier1Result = {} } = sessionContext;

  const eventTypes = events.map((e) => e.eventType);
  const matchedType = tier1Result.type || 'ambiguous_behavior';

  let explanation = 'LLM identified ambiguous friction pattern based on multi-event interaction sequence.';
  let suggestedAction = 'send_personalized_discount_nudge';
  let explainabilityTrail = [
    `Session ${sessionId} cart value $${cartValue}`,
    `Event trajectory: ${eventTypes.slice(-3).join(' -> ') || 'none'}`,
    `Tier 1 preliminary signal: ${matchedType}`,
  ];

  if (cartValue > 100) {
    explanation = `High-value cart ($${cartValue}) showing hesitance on checkout. Escalated to Tier 3 LLM for deep friction analysis.`;
    suggestedAction = 'human_agent_callback';
    explainabilityTrail.push('High cart value threshold triggered AI agent routing');
  } else if (matchedType === 'payment_failure') {
    explanation = 'Repeated payment gateway declines analyzed. Suggested intervention: offer alternative payment method or direct support.';
    suggestedAction = 'offer_alternative_payment_gateway';
    explainabilityTrail.push('Payment gateway API error codes detected in telemetry');
  } else if (matchedType === 'cart_abandonment') {
    explanation = 'Cart idle timeout detected across session stream. Suggested recovery: automated cart recovery nudge with 10% promo code.';
    suggestedAction = 'send_cart_recovery_nudge';
    explainabilityTrail.push('High dwell time without conversion');
  }

  return {
    type: matchedType,
    confidence: tier1Result.confidence ? Math.min(tier1Result.confidence + 0.1, 0.95) : 0.88,
    explanation,
    suggestedAction,
    explainabilityTrail,
  };
}

module.exports = { diagnoseFriction };
