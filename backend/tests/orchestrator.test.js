const {
  orchestrateFrictionCascade,
  getCostEfficiencyMetrics,
  resetCascadeMetrics,
} = require('../src/services/orchestrator');

describe('Task 4 & 5 - Orchestrator & Cascade Decision Boundary', () => {
  beforeEach(() => {
    resetCascadeMetrics();
  });

  it('should resolve at Tier 1 for high confidence rule match with low cart value', async () => {
    const session = { sessionId: 'sess_t1', cartValue: 50 };
    const events = [
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'DECLINED' } },
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'INSUFFICIENT_FUNDS' } },
    ];

    const result = await orchestrateFrictionCascade(session, events);

    expect(result.cascadeDecision.detectedBy).toBe('tier1');
    expect(result.cascadeDecision.escalated).toBe(false);
    expect(result.frictionEvent.type).toBe('payment_failure');

    const metrics = getCostEfficiencyMetrics();
    expect(metrics.resolvedAtTier1Count).toBe(1);
    expect(metrics.escalatedToTier3Count).toBe(0);
    expect(metrics.tier1ResolutionPercentage).toBe(100);
  });

  it('should escalate to Tier 3 when cart value exceeds high-risk threshold ($100)', async () => {
    const session = { sessionId: 'sess_t3_high_value', cartValue: 250 };
    const events = [
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'DECLINED' } },
      { eventType: 'payment_attempt', metadata: { paymentFailed: true, paymentErrorCode: 'INSUFFICIENT_FUNDS' } },
    ];

    const result = await orchestrateFrictionCascade(session, events);

    expect(result.cascadeDecision.detectedBy).toBe('tier3');
    expect(result.cascadeDecision.escalated).toBe(true);
    expect(result.frictionEvent.aiDiagnosis).toBeDefined();
    expect(result.frictionEvent.aiDiagnosis.explanation).toContain('High-value cart');

    const metrics = getCostEfficiencyMetrics();
    expect(metrics.escalatedToTier3Count).toBe(1);
  });

  it('should escalate to Tier 3 for ambiguous / low confidence friction', async () => {
    const session = { sessionId: 'sess_ambiguous', cartValue: 30 };
    const events = [{ eventType: 'page_view', metadata: { page: 'category' } }];

    const result = await orchestrateFrictionCascade(session, events);

    expect(result.cascadeDecision.detectedBy).toBe('tier3');
    expect(result.cascadeDecision.escalated).toBe(true);
  });
});
