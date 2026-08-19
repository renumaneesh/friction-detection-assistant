const DEFAULT_TYPE_METRICS = {
  cart_abandonment: { dropOffFrequency: 0.70, recoveryRate: 0.15 },
  payment_failure: { dropOffFrequency: 0.85, recoveryRate: 0.20 },
  step_dropoff: { dropOffFrequency: 0.60, recoveryRate: 0.25 },
  rage_clicks: { dropOffFrequency: 0.50, recoveryRate: 0.10 },
  promo_loop: { dropOffFrequency: 0.40, recoveryRate: 0.30 },
  time_on_page_exceeded: { dropOffFrequency: 0.45, recoveryRate: 0.20 },
  default: { dropOffFrequency: 0.50, recoveryRate: 0.20 },
};

/**
 * Calculate Revenue At Risk for a single friction event or session context
 * Formula: revenueAtRisk = cartValue * dropOffFrequency * (1 - historicalRecoveryRate) * confidence
 *
 * @param {Object} params - { cartValue, type, confidence, dropOffFrequency, recoveryRate }
 * @returns {Number} Rounded revenue at risk amount in USD
 */
function calculateRevenueAtRisk({ cartValue = 0, type = 'default', confidence = 1.0, dropOffFrequency, recoveryRate }) {
  if (!cartValue || cartValue <= 0) return 0;

  const defaultMetrics = DEFAULT_TYPE_METRICS[type] || DEFAULT_TYPE_METRICS.default;

  const freq = typeof dropOffFrequency === 'number' ? dropOffFrequency : defaultMetrics.dropOffFrequency;
  const rate = typeof recoveryRate === 'number' ? recoveryRate : defaultMetrics.recoveryRate;

  const risk = cartValue * freq * (1 - rate) * confidence;
  return Number(risk.toFixed(2));
}

/**
 * Aggregate total revenue at risk across multiple friction events
 *
 * @param {Array} frictionEvents - List of friction event objects
 * @returns {Object} { totalRevenueAtRisk, breakdownByType, totalEventsCount }
 */
function aggregateRevenueAtRisk(frictionEvents = []) {
  let totalRevenueAtRisk = 0;
  const breakdownByType = {};

  for (const event of frictionEvents) {
    const type = event.type || 'default';
    const risk = typeof event.revenueAtRisk === 'number'
      ? event.revenueAtRisk
      : calculateRevenueAtRisk({ cartValue: event.cartValue || 0, type });

    totalRevenueAtRisk += risk;

    if (!breakdownByType[type]) {
      breakdownByType[type] = {
        type,
        eventCount: 0,
        revenueAtRisk: 0,
      };
    }

    breakdownByType[type].eventCount += 1;
    breakdownByType[type].revenueAtRisk = Number((breakdownByType[type].revenueAtRisk + risk).toFixed(2));
  }

  return {
    totalRevenueAtRisk: Number(totalRevenueAtRisk.toFixed(2)),
    totalEventsCount: frictionEvents.length,
    breakdownByType,
  };
}

module.exports = {
  calculateRevenueAtRisk,
  aggregateRevenueAtRisk,
  DEFAULT_TYPE_METRICS,
};
