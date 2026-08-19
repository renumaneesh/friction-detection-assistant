const express = require('express');
const router = express.Router();
const { generateSystemicInsights } = require('../services/insightAggregator');
const { aggregateRevenueAtRisk } = require('../services/revenueRisk');
const { cascadeMetrics } = require('../services/orchestrator');
const FrictionEvent = require('../models/FrictionEvent');
const mongoose = require('mongoose');

/**
 * GET /api/insights/systemic
 * Returns cross-session systemic insight breakdown powering the dashboard
 */
router.get('/insights/systemic', async (req, res, next) => {
  try {
    const { startDate, endDate, type, minConfidence } = req.query;
    const insightsData = await generateSystemicInsights({
      startDate,
      endDate,
      type,
      minConfidence,
    });

    res.json({
      success: true,
      data: insightsData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/insights/revenue-at-risk
 * Returns aggregated revenue at risk stats
 */
router.get('/insights/revenue-at-risk', async (req, res, next) => {
  try {
    let events = [];

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        events = await FrictionEvent.find({}).lean();
      }
    } catch (err) {
      console.warn('[InsightsRoute] DB fetch fallback:', err.message);
    }

    if (events.length === 0) {
      events = cascadeMetrics.frictionEventsStore;
    }

    const aggregated = aggregateRevenueAtRisk(events);

    res.json({
      success: true,
      data: aggregated,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
