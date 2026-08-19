const mongoose = require('mongoose');

const FrictionEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    detectedBy: {
      type: String,
      enum: ['tier1', 'tier3'],
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    reason: {
      type: String,
      required: true,
    },
    revenueAtRisk: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['detected', 'pending_action', 'resolved', 'escalated'],
      default: 'detected',
    },
    aiDiagnosis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.FrictionEvent || mongoose.model('FrictionEvent', FrictionEventSchema);
