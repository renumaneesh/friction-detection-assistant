const FrictionEvent = require('../models/FrictionEvent');
const { cascadeMetrics } = require('./orchestrator');
const mongoose = require('mongoose');

/**
 * Generate systemic insights from friction events
 *
 * @param {Object} filters - { startDate, endDate, type, minConfidence }
 * @returns {Promise<Object>} Systemic insight breakdown
 */
async function generateSystemicInsights(filters = {}) {
  let events = [];

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const query = {};
      if (filters.type) query.type = filters.type;
      if (filters.minConfidence) query.confidence = { $gte: parseFloat(filters.minConfidence) };
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }
      events = await FrictionEvent.find(query).lean();
    }
  } catch (err) {
    console.warn('[InsightAggregator] DB query failed, falling back to in-memory store:', err.message);
  }

  // Fallback to in-memory store if DB events empty or unavailable
  if (events.length === 0 && cascadeMetrics.frictionEventsStore.length > 0) {
    events = cascadeMetrics.frictionEventsStore.filter((e) => {
      if (filters.type && e.type !== filters.type) return false;
      if (filters.minConfidence && e.confidence < parseFloat(filters.minConfidence)) return false;
      return true;
    });
  }

  const totalEvents = events.length;
  if (totalEvents === 0) {
    return {
      summary: {
        totalFrictionEvents: 0,
        totalRevenueAtRisk: 0,
        topFrictionBottleneck: null,
      },
      insights: [],
    };
  }

  const groupStats = {};
  let globalRevenueAtRisk = 0;

  for (const event of events) {
    const type = event.type || 'unknown';
    const risk = typeof event.revenueAtRisk === 'number' ? event.revenueAtRisk : 0;
    globalRevenueAtRisk += risk;

    if (!groupStats[type]) {
      groupStats[type] = {
        type,
        sessionCount: 0,
        sessionsSet: new Set(),
        totalRevenueAtRisk: 0,
        avgConfidence: 0,
        confidenceSum: 0,
      };
    }

    const group = groupStats[type];
    group.sessionsSet.add(event.sessionId);
    group.totalRevenueAtRisk += risk;
    group.confidenceSum += event.confidence || 0;
  }

  let topBottleneck = null;
  let maxRevenueAtRisk = -1;

  const insights = Object.values(groupStats).map((group) => {
    const sessionCount = group.sessionsSet.size;
    const pctOfTotalFriction = Number(((sessionCount / totalEvents) * 100).toFixed(1));
    const roundedRisk = Number(group.totalRevenueAtRisk.toFixed(2));

    if (roundedRisk > maxRevenueAtRisk) {
      maxRevenueAtRisk = roundedRisk;
      topBottleneck = group.type;
    }

    return {
      type: group.type,
      sessionCount,
      pctOfTotalFriction,
      totalRevenueAtRisk: roundedRisk,
      avgConfidence: Number((group.confidenceSum / sessionCount).toFixed(2)),
    };
  });

  // Sort insights by totalRevenueAtRisk descending
  insights.sort((a, b) => b.totalRevenueAtRisk - a.totalRevenueAtRisk);

  return {
    summary: {
      totalFrictionEvents: totalEvents,
      totalRevenueAtRisk: Number(globalRevenueAtRisk.toFixed(2)),
      topFrictionBottleneck: topBottleneck,
    },
    insights,
  };
}

module.exports = {
  generateSystemicInsights,
};
