const env = require('../config/env');

const DEFAULT_CONFIG = {
  timeOnPageThresholdMs: env.TIME_ON_PAGE_THRESHOLD_MS || 120000,
  cartAbandonmentTimeoutMs: env.CART_ABANDONMENT_TIMEOUT_MS || 1200000,
  maxFailedPayments: env.MAX_FAILED_PAYMENT_ATTEMPTS || 2,
  highDropoffSteps: ['shipping_info', 'payment_info', 'checkout_step_2', 'address_step', 'checkout_review'],
  rageClickThreshold: 5,
  maxPromoCodeErrors: 2,
};

/**
 * Detect time on page threshold violations
 */
function detectTimeOnPage(session, events, config) {
  const violatingEvent = events.find((e) => {
    const timeOnPage = e.metadata?.timeOnPageMs || e.metadata?.dwellTimeMs || 0;
    return timeOnPage >= config.timeOnPageThresholdMs;
  });

  if (violatingEvent) {
    const dwell = violatingEvent.metadata?.timeOnPageMs || violatingEvent.metadata?.dwellTimeMs;
    const stepName = violatingEvent.metadata?.stepName || violatingEvent.metadata?.page || 'checkout_page';
    return {
      detected: true,
      type: 'time_on_page_exceeded',
      confidence: 0.80,
      reason: `Spent ${Math.round(dwell / 1000)}s on ${stepName}, exceeding threshold of ${config.timeOnPageThresholdMs / 1000}s`,
      matchedSignals: [`high_dwell_time: ${dwell}ms`, `step: ${stepName}`],
    };
  }

  return { detected: false };
}

/**
 * Detect cart abandonment timer violations
 */
function detectCartAbandonment(session, events, config) {
  const cartValue = session?.cartValue || 0;
  const hasItemsInCart = cartValue > 0 || events.some((e) => e.eventType === 'add_to_cart');
  const isCompleted = events.some((e) => e.eventType === 'checkout_complete' || e.eventType === 'purchase');

  if (hasItemsInCart && !isCompleted) {
    const lastEventTime = session?.lastEventAt ? new Date(session.lastEventAt).getTime() : Date.now();
    const idleTimeMs = Date.now() - lastEventTime;

    if (idleTimeMs >= config.cartAbandonmentTimeoutMs) {
      const idleMinutes = Math.round(idleTimeMs / 60000);
      return {
        detected: true,
        type: 'cart_abandonment',
        confidence: 0.85,
        reason: `Cart idle for ${idleMinutes} min with cart value $${cartValue}`,
        matchedSignals: [`cart_value: $${cartValue}`, `idle_time: ${idleMinutes}m`],
      };
    }
  }

  return { detected: false };
}

/**
 * Detect repeated payment failures
 */
function detectPaymentFailure(session, events, config) {
  const failedPaymentEvents = events.filter((e) => {
    const isPaymentType = e.eventType === 'payment_attempt' || e.eventType === 'payment_failed';
    const isFailed = e.metadata?.paymentFailed === true || e.metadata?.paymentErrorCode || e.eventType === 'payment_failed';
    return isPaymentType && isFailed;
  });

  if (failedPaymentEvents.length >= config.maxFailedPayments) {
    const lastError = failedPaymentEvents[failedPaymentEvents.length - 1]?.metadata?.paymentErrorCode || 'DECLINED';
    return {
      detected: true,
      type: 'payment_failure',
      confidence: 0.92,
      reason: `Repeated payment failures (${failedPaymentEvents.length} attempts, error: ${lastError})`,
      matchedSignals: [`failed_payment_attempts: ${failedPaymentEvents.length}`, `last_error_code: ${lastError}`],
    };
  }

  return { detected: false };
}

/**
 * Detect drop-off at specific checkout steps
 */
function detectStepDropoff(session, events, config) {
  if (!events || events.length === 0) return { detected: false };

  const lastEvent = events[events.length - 1];
  const stepName = lastEvent.metadata?.stepName || lastEvent.metadata?.page;
  const isDropoffStep = config.highDropoffSteps.includes(stepName) || lastEvent.eventType === 'checkout_step';
  const isCompleted = events.some((e) => e.eventType === 'checkout_complete' || e.eventType === 'purchase');

  if (isDropoffStep && !isCompleted && session?.status !== 'converted') {
    return {
      detected: true,
      type: 'step_dropoff',
      confidence: 0.78,
      reason: `Customer session dropped off at critical step: ${stepName || 'checkout'}`,
      matchedSignals: [`last_step: ${stepName}`, `session_status: ${session?.status || 'active'}`],
    };
  }

  return { detected: false };
}

/**
 * Detect rage clicks on checkout action buttons
 */
function detectRageClicks(session, events, config) {
  const rageClickEvent = events.find((e) => (e.metadata?.clickCount || 0) >= config.rageClickThreshold);

  if (rageClickEvent) {
    const clicks = rageClickEvent.metadata.clickCount;
    const element = rageClickEvent.metadata.elementId || 'submit_button';
    return {
      detected: true,
      type: 'rage_clicks',
      confidence: 0.88,
      reason: `Rage clicking detected: ${clicks} rapid clicks on ${element}`,
      matchedSignals: [`rapid_clicks: ${clicks}`, `element: ${element}`],
    };
  }

  return { detected: false };
}

/**
 * Detect repeated promo code error loops
 */
function detectPromoLoop(session, events, config) {
  const promoErrors = events.filter((e) => e.eventType === 'promo_code_error' || e.metadata?.promoFailed === true);

  if (promoErrors.length >= config.maxPromoCodeErrors) {
    return {
      detected: true,
      type: 'promo_loop',
      confidence: 0.82,
      reason: `Promo code error loop: ${promoErrors.length} invalid attempts`,
      matchedSignals: [`promo_attempts: ${promoErrors.length}`],
    };
  }

  return { detected: false };
}

/**
 * Main Tier 1 Detection Engine
 * Runs all detectors against session & event stream.
 */
function detectFrictionTier1(session, events = [], configOverrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  // Order of priority for friction detection
  const detectors = [
    detectPaymentFailure,
    detectRageClicks,
    detectCartAbandonment,
    detectTimeOnPage,
    detectPromoLoop,
    detectStepDropoff,
  ];

  const detectedResults = [];

  for (const detector of detectors) {
    const result = detector(session, events, config);
    if (result.detected) {
      detectedResults.push(result);
    }
  }

  if (detectedResults.length > 0) {
    // Sort by confidence descending
    detectedResults.sort((a, b) => b.confidence - a.confidence);
    return {
      ...detectedResults[0],
      allDetections: detectedResults,
    };
  }

  return {
    detected: false,
    confidence: 0,
    type: 'none',
    reason: 'No friction detected by Tier 1 rules',
    matchedSignals: [],
  };
}

module.exports = {
  detectFrictionTier1,
  detectTimeOnPage,
  detectCartAbandonment,
  detectPaymentFailure,
  detectStepDropoff,
  detectRageClicks,
  detectPromoLoop,
  DEFAULT_CONFIG,
};
