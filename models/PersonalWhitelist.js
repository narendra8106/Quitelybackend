const mongoose = require('mongoose');

/**
 * Once a user marks something "not spam," it goes here and is NEVER
 * auto-blocked again - regardless of what the shared SpamNumber/keyword
 * data says. This is what fixes the "delivery agent got blocked" problem:
 * the fix is permanent and personal, not just a one-time log correction.
 */
const personalWhitelistSchema = new mongoose.Schema(
  {
    senderId: {
      type: String, // normalized phone number or email
      required: true,
      unique: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['call', 'sms', 'email'],
      required: true,
    },
    reason: {
      type: String,
      default: 'User marked as not spam',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PersonalWhitelist', personalWhitelistSchema);
