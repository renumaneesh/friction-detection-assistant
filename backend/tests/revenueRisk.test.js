const { calculateRevenueAtRisk, aggregateRevenueAtRisk } = require('../src/services/revenueRisk');

describe('Task 6 - Revenue-at-Risk Scoring Arithmetic', () => {
  it('should correctly calculate revenue at risk for single cart_abandonment event', () => {
    // Formula: cartValue * dropOffFrequency * (1 - recoveryRate)
    // cart_abandonment: freq = 0.70, recovery = 0.15 => factor = 0.70 * 0.85 = 0.595
    // 100 * 0.595 = 59.50
    const risk = calculateRevenueAtRisk({ cartValue: 100, type: 'cart_abandonment' });
    expect(risk).toBe(59.5);
  });

  it('should return 0 for cart value <= 0', () => {
    expect(calculateRevenueAtRisk({ cartValue: 0, type: 'cart_abandonment' })).toBe(0);
    expect(calculateRevenueAtRisk({ cartValue: -10, type: 'payment_failure' })).toBe(0);
  });

  it('should aggregate revenue at risk across multiple friction events', () => {
    const events = [
      { type: 'cart_abandonment', cartValue: 100, revenueAtRisk: 59.5 },
      { type: 'payment_failure', cartValue: 200, revenueAtRisk: 136.0 },
      { type: 'cart_abandonment', cartValue: 50, revenueAtRisk: 29.75 },
    ];

    const aggregated = aggregateRevenueAtRisk(events);

    expect(aggregated.totalEventsCount).toBe(3);
    expect(aggregated.totalRevenueAtRisk).toBe(225.25);
    expect(aggregated.breakdownByType.cart_abandonment.eventCount).toBe(2);
    expect(aggregated.breakdownByType.payment_failure.eventCount).toBe(1);
  });
});
