const mongoose = require('mongoose');

/**
 * Shared spam number database used by call + SMS detection.
 * This is what gives Quietly its "community grows the blocklist" story -
 * every report increments reportCount and strengthens the trust score.
 */
const spamNumberSchema = new mongoose.Schema(
  {
    number: {
      type: String, // normalized, digits only
      required: true,
      unique: true,
      index: true,
    },
    reportCount: {
      type: Number,
      default: 1,
    },
    category: {
      type: String,
      enum: ['telemarketer', 'scam', 'robocall', 'fraud', 'unknown'],
      default: 'unknown',
    },
    lastReportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SpamNumber', spamNumberSchema);
