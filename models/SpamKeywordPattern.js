const mongoose = require('mongoose');

/**
 * Keyword/pattern rules used to score SMS bodies and email subjects/snippets.
 * Kept simple and rule-based for the hackathon - no need for a trained
 * ML model, this is honest, explainable, and fast to build.
 */
const spamKeywordPatternSchema = new mongoose.Schema(
  {
    pattern: {
      type: String, // a word/phrase to match, e.g. "click here", "loan approved"
      required: true,
    },
    weight: {
      type: Number, // how much this pattern contributes to the spam score
      default: 1,
      min: 0,
      max: 10,
    },
    appliesTo: {
      type: String,
      enum: ['sms', 'email', 'both'],
      default: 'both',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SpamKeywordPattern', spamKeywordPatternSchema);
