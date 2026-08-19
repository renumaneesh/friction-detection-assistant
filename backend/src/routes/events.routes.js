const express = require('express');
const router = express.Router();
const CustomerEvent = require('../models/CustomerEvent');
const Session = require('../models/Session');
const { orchestrateFrictionCascade } = require('../services/orchestrator');
const { routeRecoveryAction } = require('../services/automationRouter');
const mongoose = require('mongoose');

// Temporary in-memory session/events cache for fallback mode
const inMemorySessions = new Map();
const inMemoryEvents = new Map();

/**
 * POST /api/events
 * Ingest customer telemetry event and run cascade analysis
 */
router.post('/events', async (req, res, next) => {
  try {
    const { sessionId, userId, eventType, timestamp, metadata = {} } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({
        success: false,
        error: { message: 'sessionId and eventType are required fields.' },
      });
    }

    const eventTime = timestamp ? new Date(timestamp) : new Date();
    const cartValue = typeof metadata.cartValue === 'number' ? metadata.cartValue : 0;

    let customerEvent = null;
    let session = null;

    // Try MongoDB write if connected
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        customerEvent = await CustomerEvent.create({
          sessionId,
          userId,
          eventType,
          timestamp: eventTime,
          metadata,
        });

        session = await Session.findOneAndUpdate(
          { sessionId },
          {
            $set: {
              userId: userId || undefined,
              lastEventAt: eventTime,
            },
            $max: { cartValue },
            $setOnInsert: { startedAt: eventTime, status: 'active' },
            $push: { events: customerEvent._id },
          },
          { upsert: true, new: true }
        );
      }
    } catch (dbErr) {
      console.warn('[EventsRoute] DB operation fallback to memory:', dbErr.message);
    }

    // Fallback in-memory session tracking
    if (!session) {
      if (!inMemoryEvents.has(sessionId)) {
        inMemoryEvents.set(sessionId, []);
      }
      const existingEvents = inMemoryEvents.get(sessionId);
      customerEvent = {
        _id: new mongoose.Types.ObjectId().toString(),
        sessionId,
        userId,
        eventType,
        timestamp: eventTime,
        metadata,
      };
      existingEvents.push(customerEvent);

      const existingSession = inMemorySessions.get(sessionId) || {
        sessionId,
        userId,
        startedAt: eventTime,
        lastEventAt: eventTime,
        cartValue: 0,
        status: 'active',
        events: [],
      };

      existingSession.lastEventAt = eventTime;
      existingSession.cartValue = Math.max(existingSession.cartValue, cartValue);
      existingSession.events.push(customerEvent);
      inMemorySessions.set(sessionId, existingSession);
      session = existingSession;
    }

    const sessionEvents = (mongoose.connection && mongoose.connection.readyState === 1)
      ? await CustomerEvent.find({ sessionId }).sort({ timestamp: 1 }).lean()
      : inMemoryEvents.get(sessionId) || [customerEvent];

    // Trigger cascade detection & orchestration
    const cascadeResult = await orchestrateFrictionCascade(session, sessionEvents);

    let recoveryAction = null;
    if (cascadeResult.frictionEvent && cascadeResult.frictionEvent.type !== 'none') {
      recoveryAction = await routeRecoveryAction({
        frictionEvent: cascadeResult.frictionEvent,
        session,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        event: customerEvent,
        session: {
          sessionId: session.sessionId,
          cartValue: session.cartValue,
          status: session.status,
        },
        friction: cascadeResult.frictionEvent,
        cascadeDecision: cascadeResult.cascadeDecision,
        recoveryAction,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
