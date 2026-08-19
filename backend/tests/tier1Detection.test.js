const {
  detectFrictionTier1,
  detectTimeOnPage,
  detectCartAbandonment,
  detectPaymentFailure,
  detectStepDropoff,
  detectRageClicks,
  detectPromoLoop,
} = require('../src/services/tier1Detection');

describe('Task 3 - Tier 1 Rule-Based Detection Engine', () => {
  it('should detect time on page threshold violation', () => {
    const session = { sessionId: 'sess_1' };
    const events = [
      { eventType: 'checkout_step', metadata: { timeOnPageMs: 150000, stepName: 'payment_info' } },
    ];
    const result = detectTimeOnPage(session, events, { timeOnPageThresholdMs: 120000 });
    expect(result.detected).toBe(true);
    expect(result.type).toBe('time_on_page_exceeded');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('should detect cart abandonment timer violation', () => {
    const twentyFiveMinsAgo = new Date(Date.now() - 25 * 60 * 1000);
    const session = { sessionId: 'sess_2', cartValue: 142, lastEventAt: twentyFiveMinsAgo };
    const events = [{ eventType: 'add_to_cart', metadata: { cartValue: 142 } }];
    const result = detectCartAbandonment(session, events, { cartAbandonmentTimeoutMs: 1200000 });
    expect(result.detected).toBe(true);
    expect(result.type).toBe('cart_abandonment');
    expect(result.reason).toContain('$142');
  });

  it('should detect repeated failed payments', () => {
    const session = { sessionId: 'sess_3' };
    const events = [
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'CARD_DECLINED' } },
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'INSUFFICIENT_FUNDS' } },
    ];
    const result = detectPaymentFailure(session, events, { maxFailedPayments: 2 });
    expect(result.detected).toBe(true);
    expect(result.type).toBe('payment_failure');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should detect step drop-off at critical checkout step', () => {
    const session = { sessionId: 'sess_4', status: 'active' };
    const events = [
      { eventType: 'page_view', metadata: { stepName: 'home' } },
      { eventType: 'checkout_step', metadata: { stepName: 'shipping_info' } },
    ];
    const result = detectStepDropoff(session, events, {
      highDropoffSteps: ['shipping_info', 'payment_info'],
    });
    expect(result.detected).toBe(true);
    expect(result.type).toBe('step_dropoff');
  });

  it('should detect rage clicks', () => {
    const session = { sessionId: 'sess_5' };
    const events = [
      { eventType: 'click', metadata: { clickCount: 7, elementId: 'pay_now_button' } },
    ];
    const result = detectRageClicks(session, events, { rageClickThreshold: 5 });
    expect(result.detected).toBe(true);
    expect(result.type).toBe('rage_clicks');
  });

  it('should detect promo code error loop', () => {
    const session = { sessionId: 'sess_6' };
    const events = [
      { eventType: 'promo_code_error', metadata: { code: 'DISCOUNT50' } },
      { eventType: 'promo_code_error', metadata: { code: 'FREESHIP' } },
    ];
    const result = detectPromoLoop(session, events, { maxPromoCodeErrors: 2 });
    expect(result.detected).toBe(true);
    expect(result.type).toBe('promo_loop');
  });

  it('should run full detectFrictionTier1 and return highest confidence match', () => {
    const session = { sessionId: 'sess_7', cartValue: 200, lastEventAt: new Date(Date.now() - 30 * 60 * 1000) };
    const events = [
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'EXPIRED_CARD' } },
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'EXPIRED_CARD' } },
      { eventType: 'checkout_step', metadata: { stepName: 'payment_info', timeOnPageMs: 180000 } },
    ];
    const result = detectFrictionTier1(session, events);
    expect(result.detected).toBe(true);
    expect(result.type).toBe('payment_failure'); // Highest confidence detector
    expect(result.allDetections.length).toBeGreaterThan(1);
  });
});
