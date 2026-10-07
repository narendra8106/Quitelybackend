const mongoose = require('mongoose');

/**
 * BlockedItem is the single source of truth for every spam event caught
 * across all three channels (call / sms / email).
 *
 * senderId is the normalized identity key that makes cross-channel
 * correlation possible later (Day 6): phone numbers get stripped of
 * formatting, emails get lowercased, so two records from different
 * channels can be compared on a consistent field.
 */
const blockedItemSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ['call', 'sms', 'email'],
      required: true,
      index: true,
    },

    // Raw sender as received (e.g. "+91 98765-43210" or "Loans <scam@fake.com>")
    sender: {
      type: String,
      required: true,
    },

    // Normalized identity for correlation matching.
    // Phone: digits only, e.g. "919876543210"
    // Email: lowercased address, e.g. "scam@fake.com"
    senderId: {
      type: String,
      required: true,
      index: true,
    },

    // For email specifically - domain extracted separately, useful for
    // correlation even when the local part of the address varies
    senderDomain: {
      type: String,
      default: null,
      index: true,
    },

    reason: {
      type: String,
      required: true,
    },

    // Raw content snippet - SMS body, email subject/snippet, or null for calls
    contentSnippet: {
      type: String,
      default: null,
    },

    // How many times this senderId has been reported/blocked historically
    reportCount: {
      type: Number,
      default: 1,
    },

    // Cross-channel correlation fields (Day 6 feature)
    linkedIdentities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BlockedItem',
      },
    ],
    isCoordinatedThreat: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Was this later reported as a false positive by the user?
    userMarkedSafe: {
      type: Boolean,
      default: false,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index to speed up correlation queries (same senderId pattern
// across a recent time window)
blockedItemSchema.index({ senderId: 1, timestamp: -1 });

module.exports = mongoose.model('BlockedItem', blockedItemSchema);
