const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastEventAt: {
      type: Date,
      default: Date.now,
    },
    cartValue: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'abandoned', 'recovered', 'converted'],
      default: 'active',
    },
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerEvent',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Session || mongoose.model('Session', SessionSchema);
