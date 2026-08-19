const request = require('supertest');
const app = require('../src/app');
const { resetCascadeMetrics } = require('../src/services/orchestrator');

describe('Task 7, 8, 9 - Core REST Endpoints Integration', () => {
  beforeEach(() => {
    resetCascadeMetrics();
  });

  it('POST /api/events should ingest telemetry event and run cascade friction analysis', async () => {
    const payload = {
      sessionId: 'sess_route_101',
      userId: 'user_99',
      eventType: 'payment_attempt',
      metadata: {
        cartValue: 75,
        paymentFailed: true,
        paymentErrorCode: 'CARD_DECLINED',
      },
    };

    // First payment attempt
    await request(app).post('/api/events').send(payload);

    // Second payment attempt -> trigger Tier 1 payment failure
    const res = await request(app).post('/api/events').send(payload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.sessionId).toBe('sess_route_101');
    expect(res.body.data.friction.type).toBe('payment_failure');
    expect(res.body.data.cascadeDecision.detectedBy).toBe('tier1');
  });

  it('GET /api/friction/events should return list of detected friction events', async () => {
    const res = await request(app).get('/api/friction/events');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/metrics/cost-efficiency should return live cost efficiency breakdown', async () => {
    const res = await request(app).get('/api/metrics/cost-efficiency');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('tier1ResolutionPercentage');
    expect(res.body.data).toHaveProperty('estimatedLlmCostSavedUsd');
  });

  it('GET /api/insights/systemic should return queryable systemic friction breakdown', async () => {
    const res = await request(app).get('/api/insights/systemic');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('insights');
  });

  it('GET /api/automation/human-queue and PATCH /api/automation/:id/resolve flow', async () => {
    // Ingest high-value cart event to create a pending human escalation
    const highValuePayload = {
      sessionId: 'sess_high_value_escalation',
      eventType: 'payment_attempt',
      metadata: {
        cartValue: 500,
        paymentFailed: true,
        paymentErrorCode: 'EXPIRED_CARD',
      },
    };

    await request(app).post('/api/events').send(highValuePayload);
    await request(app).post('/api/events').send(highValuePayload);

    // Fetch queue
    const queueRes = await request(app).get('/api/automation/human-queue');
    expect(queueRes.statusCode).toEqual(200);
    expect(queueRes.body.success).toBe(true);
    expect(queueRes.body.data.length).toBeGreaterThan(0);

    const pendingItem = queueRes.body.data[0];
    expect(pendingItem.status).toBe('pending');
    expect(pendingItem.riskLevel).toBe('high');

    // Approve escalation
    const resolveRes = await request(app)
      .patch(`/api/automation/${pendingItem._id}/resolve`)
      .send({ decision: 'approved', notes: 'Approved agent callback with 15% discount.' });

    expect(resolveRes.statusCode).toEqual(200);
    expect(resolveRes.body.success).toBe(true);
    expect(resolveRes.body.data.status).toBe('approved');
  });

  it('GET /api/docs should return OpenAPI specification', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.statusCode).toEqual(200);
    expect(res.body.openapi).toBe('3.0.3');
  });
});
