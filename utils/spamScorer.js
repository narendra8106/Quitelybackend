const SpamKeywordPattern = require('../models/SpamKeywordPattern');

/**
 * Scores a piece of text (SMS body or email subject/snippet) against
 * stored keyword patterns. Simple weighted sum - explainable, fast,
 * no ML model needed for the hackathon scope.
 *
 * Returns { score, matchedPatterns } - matchedPatterns feeds directly
 * into the "reason" field so blocking is always transparent to the user.
 */
async function scoreText(text, channel) {
  if (!text) return { score: 0, matchedPatterns: [] };

  const lowerText = text.toLowerCase();
  const patterns = await SpamKeywordPattern.find({
    appliesTo: { $in: [channel, 'both'] },
  });

  let score = 0;
  const matchedPatterns = [];

  for (const p of patterns) {
    if (lowerText.includes(p.pattern.toLowerCase())) {
      score += p.weight;
      matchedPatterns.push(p.pattern);
    }
  }

  return { score, matchedPatterns };
}

// Score >= this threshold is considered spam
const SPAM_THRESHOLD = 3;

module.exports = { scoreText, SPAM_THRESHOLD };
