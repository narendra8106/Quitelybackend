const BlockedItem = require('../models/BlockedItem');

const WINDOW_MINUTES = parseInt(process.env.CORRELATION_WINDOW_MINUTES || '30', 10);

/**
 * After a new BlockedItem is saved, check whether it correlates with
 * any other recent BlockedItem - i.e. the same threat trying to reach
 * the user through a different channel within the time window.
 *
 * Matching strategy (kept intentionally simple for hackathon scope):
 *  1. Exact senderId match across channels (rare - a scammer's phone
 *     number won't equal an email address) - mostly useful for repeated
 *     call+sms from the same number, which is already same-channel-ish.
 *  2. Domain/keyword overlap: if an email's domain or subject shares
 *     wording with a recent SMS/call reason, flag as related.
 *
 * For the hackathon demo, the most reliable and easiest-to-trigger path
 * is: same normalized sender across CALL and SMS (a scammer reusing one
 * number for both), plus a time-boxed link to any EMAIL whose snippet
 * shares 2+ significant words with the SMS/call reason.
 *
 * Returns the newItem after linking (mutates + saves if a correlation found).
 */
async function checkCorrelation(newItem) {
  const windowStart = new Date(newItem.timestamp.getTime() - WINDOW_MINUTES * 60 * 1000);
  const windowEnd = new Date(newItem.timestamp.getTime() + WINDOW_MINUTES * 60 * 1000);

  // 1. Same senderId, different channel, within window (call <-> sms reuse)
  const sameSenderDifferentChannel = await BlockedItem.find({
    _id: { $ne: newItem._id },
    senderId: newItem.senderId,
    channel: { $ne: newItem.channel },
    timestamp: { $gte: windowStart, $lte: windowEnd },
  });

  // 2. For email items, check for keyword overlap with recent call/sms reasons
  let keywordMatches = [];
  if (newItem.contentSnippet) {
    const words = extractSignificantWords(newItem.contentSnippet);
    if (words.length > 0) {
      const candidates = await BlockedItem.find({
        _id: { $ne: newItem._id },
        channel: { $ne: newItem.channel },
        timestamp: { $gte: windowStart, $lte: windowEnd },
      });
      keywordMatches = candidates.filter((c) => {
        const candidateWords = extractSignificantWords(c.contentSnippet || c.reason || '');
        const overlap = words.filter((w) => candidateWords.includes(w));
        return overlap.length >= 2;
      });
    }
  }

  const allMatches = [...sameSenderDifferentChannel, ...keywordMatches];

  if (allMatches.length > 0) {
    const matchIds = allMatches.map((m) => m._id);
    newItem.linkedIdentities = matchIds;
    newItem.isCoordinatedThreat = true;
    await newItem.save();

    // Also mark the matched items as part of the coordinated threat
    await BlockedItem.updateMany(
      { _id: { $in: matchIds } },
      {
        $addToSet: { linkedIdentities: newItem._id },
        $set: { isCoordinatedThreat: true },
      }
    );
  }

  return newItem;
}

// Simple stopword-filtered word extraction for fuzzy matching
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'you', 'your', 'to', 'and', 'of', 'for',
  'this', 'that', 'has', 'have', 'with', 'on', 'in', 'it', 'be', 'was',
]);

function extractSignificantWords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

module.exports = { checkCorrelation };
