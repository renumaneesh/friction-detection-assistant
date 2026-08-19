const mongoose = require('mongoose');

const RecoveryActionSchema = new mongoose.Schema(
  {
    frictionEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FrictionEvent',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'high'],
      default: 'low',
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'auto_executed', 'approved', 'rejected'],
      default: 'pending',
    },
    explainability: [
      {
        type: String,
      },
    ],
    draftedResponse: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.RecoveryAction || mongoose.model('RecoveryAction', RecoveryActionSchema);
