const express = require('express');
const router = express.Router();
const FrictionEvent = require('../models/FrictionEvent');
const CustomerEvent = require('../models/CustomerEvent');
const Session = require('../models/Session');
const { getCostEfficiencyMetrics, orchestrateFrictionCascade, cascadeMetrics } = require('../services/orchestrator');
const mongoose = require('mongoose');

/**
 * GET /api/friction/events
 * List friction events (filterable by type, sessionId, detectedBy, minConfidence)
 */
router.get('/friction/events', async (req, res, next) => {
  try {
    const { type, sessionId, detectedBy, minConfidence } = req.query;
    let events = [];

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const filter = {};
        if (type) filter.type = type;
        if (sessionId) filter.sessionId = sessionId;
        if (detectedBy) filter.detectedBy = detectedBy;
        if (minConfidence) filter.confidence = { $gte: parseFloat(minConfidence) };

        events = await FrictionEvent.find(filter).sort({ createdAt: -1 }).lean();
      }
    } catch (err) {
      console.warn('[FrictionRoute] DB query fallback to memory store:', err.message);
    }

    if (events.length === 0 && cascadeMetrics.frictionEventsStore.length > 0) {
      events = cascadeMetrics.frictionEventsStore.filter((e) => {
        if (type && e.type !== type) return false;
        if (sessionId && e.sessionId !== sessionId) return false;
        if (detectedBy && e.detectedBy !== detectedBy) return false;
        if (minConfidence && e.confidence < parseFloat(minConfidence)) return false;
        return true;
      });
    }

    res.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/friction/events/:id
 * Single friction event by ID with explainability trail
 */
router.get('/friction/events/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let event = null;

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
        event = await FrictionEvent.findById(id).lean();
      }
    } catch (err) {
      console.warn('[FrictionRoute] DB findById fallback:', err.message);
    }

    if (!event) {
      event = cascadeMetrics.frictionEventsStore.find((e) => e._id.toString() === id.toString() || e.sessionId === id);
    }

    if (!event) {
      return res.status(404).json({
        success: false,
        error: { message: `FrictionEvent not found with ID: ${id}` },
      });
    }

    res.json({
      success: true,
      data: {
        ...event,
        explainabilityTrail: event.aiDiagnosis?.explainabilityTrail || event.matchedSignals || [
          `Detected by ${event.detectedBy}`,
          `Confidence: ${event.confidence}`,
          `Reason: ${event.reason}`,
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/friction/analyze-session
 * Trigger friction analysis for a session ID
 */
router.post('/friction/analyze-session', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'sessionId is required.' },
      });
    }

    let session = null;
    let events = [];

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        session = await Session.findOne({ sessionId }).lean();
        events = await CustomerEvent.find({ sessionId }).sort({ timestamp: 1 }).lean();
      }
    } catch (err) {
      console.warn('[FrictionRoute] DB find error:', err.message);
    }

    if (!session) {
      session = { sessionId, cartValue: req.body.cartValue || 0, status: 'active' };
    }

    const result = await orchestrateFrictionCascade(session, events);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics/cost-efficiency
 * Return live demo metric stats (Tier 1 vs Tier 3 percentage, cost savings)
 */
router.get('/metrics/cost-efficiency', (req, res) => {
  const metrics = getCostEfficiencyMetrics();
  res.json({
    success: true,
    data: metrics,
  });
});

module.exports = router;
