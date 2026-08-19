const mongoose = require('mongoose');

const CustomerEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.CustomerEvent || mongoose.model('CustomerEvent', CustomerEventSchema);
