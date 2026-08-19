const CustomerEvent = require('../src/models/CustomerEvent');
const Session = require('../src/models/Session');
const FrictionEvent = require('../src/models/FrictionEvent');
const RecoveryAction = require('../src/models/RecoveryAction');
const mongoose = require('mongoose');

describe('Task 2 - Placeholder Mongoose Models', () => {
  it('CustomerEvent model should validate correctly', () => {
    const event = new CustomerEvent({
      sessionId: 'sess_123',
      userId: 'user_456',
      eventType: 'add_to_cart',
      metadata: { cartValue: 99.99 },
    });
    const err = event.validateSync();
    expect(err).toBeUndefined();
    expect(event.sessionId).toBe('sess_123');
  });

  it('Session model should validate correctly', () => {
    const session = new Session({
      sessionId: 'sess_123',
      userId: 'user_456',
      cartValue: 149.50,
      status: 'active',
    });
    const err = session.validateSync();
    expect(err).toBeUndefined();
    expect(session.cartValue).toBe(149.50);
  });

  it('FrictionEvent model should validate correctly', () => {
    const friction = new FrictionEvent({
      sessionId: 'sess_123',
      type: 'cart_abandonment',
      detectedBy: 'tier1',
      confidence: 0.85,
      reason: 'Cart idle 24 min',
      revenueAtRisk: 149.50,
    });
    const err = friction.validateSync();
    expect(err).toBeUndefined();
    expect(friction.confidence).toBe(0.85);
  });

  it('RecoveryAction model should validate correctly', () => {
    const fakeObjectId = new mongoose.Types.ObjectId();
    const action = new RecoveryAction({
      frictionEventId: fakeObjectId,
      sessionId: 'sess_123',
      actionType: 'auto_nudge',
      riskLevel: 'low',
      status: 'auto_executed',
      explainability: ['cart idle > 20 min', 'cart value $149.50'],
    });
    const err = action.validateSync();
    expect(err).toBeUndefined();
    expect(action.explainability).toHaveLength(2);
  });
});
