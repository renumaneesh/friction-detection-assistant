const express = require('express');
const router = express.Router();
const {
  getPendingHumanEscalations,
  resolveHumanEscalation,
  routeRecoveryAction,
} = require('../services/automationRouter');

/**
 * GET /api/automation/human-queue
 * List all pending recovery actions requiring human agent review
 */
router.get('/automation/human-queue', async (req, res, next) => {
  try {
    const queue = await getPendingHumanEscalations();
    res.json({
      success: true,
      count: queue.length,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/automation/:id/resolve
 * Resolve a human escalation action (decision: 'approved' | 'rejected')
 */
router.patch('/automation/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision, notes } = req.body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: { message: "decision field is required and must be 'approved' or 'rejected'." },
      });
    }

    const resolvedAction = await resolveHumanEscalation(id, { decision, notes });
    res.json({
      success: true,
      data: resolvedAction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automation/approve/:id
 * Shortcut endpoint to approve a pending human escalation
 */
router.post('/automation/approve/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    const resolvedAction = await resolveHumanEscalation(id, { decision: 'approved', notes });
    res.json({
      success: true,
      data: resolvedAction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automation/reject/:id
 * Shortcut endpoint to reject a pending human escalation
 */
router.post('/automation/reject/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    const resolvedAction = await resolveHumanEscalation(id, { decision: 'rejected', notes });
    res.json({
      success: true,
      data: resolvedAction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/automation/trigger
 * Manually trigger or test recovery action routing
 */
router.post('/automation/trigger', async (req, res, next) => {
  try {
    const { frictionEvent, session } = req.body;
    if (!frictionEvent) {
      return res.status(400).json({
        success: false,
        error: { message: 'frictionEvent payload is required.' },
      });
    }

    const action = await routeRecoveryAction({
      frictionEvent,
      session: session || { sessionId: frictionEvent.sessionId, cartValue: 0 },
    });

    res.status(201).json({
      success: true,
      data: action,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
