const BlockedItem = require('../models/BlockedItem');
const SpamNumber = require('../models/SpamNumber');
const PersonalWhitelist = require('../models/PersonalWhitelist');
const { resolveSenderIdentity, normalizePhoneNumber } = require('../utils/normalize');
const { scoreText, SPAM_THRESHOLD } = require('../utils/spamScorer');
const { checkCorrelation } = require('../utils/correlationEngine');

/**
 * Whitelist check - always runs FIRST, before any spam logic. A number
 * or email a user has explicitly cleared is never re-evaluated, no
 * matter how strong the spam signal looks. This is what stops a
 * delivery agent (or anyone else wrongly flagged) from getting blocked
 * again after being marked safe once.
 */
async function isWhitelisted(senderId) {
  const entry = await PersonalWhitelist.findOne({ senderId });
  return !!entry;
}

/**
 * Shared helper: given a decision to block, saves the BlockedItem,
 * runs correlation, and returns the saved item.
 */
async function saveBlockedItem({ channel, sender, reason, contentSnippet, reportCount }) {
  const { senderId, senderDomain } = resolveSenderIdentity(channel, sender);

  const item = new BlockedItem({
    channel,
    sender,
    senderId,
    senderDomain,
    reason,
    contentSnippet: contentSnippet || null,
    reportCount: reportCount || 1,
  });

  await item.save();
  await checkCorrelation(item);
  return item;
}

/**
 * POST /api/check-call
 * body: { number: string }
 * Called by the native CallScreeningService module before deciding
 * whether to silently reject the call.
 */
async function checkCall(req, res) {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'number is required' });

    const normalized = normalizePhoneNumber(number);

    if (await isWhitelisted(normalized)) {
      return res.json({ isSpam: false, action: 'allow', reason: 'whitelisted' });
    }

    const spamRecord = await SpamNumber.findOne({ number: normalized });

    if (spamRecord) {
      const item = await saveBlockedItem({
        channel: 'call',
        sender: number,
        reason: `Matched known ${spamRecord.category} number (reported ${spamRecord.reportCount}x)`,
      });
      return res.json({ isSpam: true, action: 'block', blockedItem: item });
    }

    return res.json({ isSpam: false, action: 'allow' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error checking call' });
  }
}

/**
 * POST /api/check-sms
 * body: { number: string, body: string }
 */
async function checkSms(req, res) {
  try {
    const { number, body } = req.body;
    if (!number || !body) {
      return res.status(400).json({ error: 'number and body are required' });
    }

    const normalized = normalizePhoneNumber(number);

    if (await isWhitelisted(normalized)) {
      return res.json({ isSpam: false, action: 'allow', reason: 'whitelisted' });
    }

    const spamRecord = await SpamNumber.findOne({ number: normalized });
    const { score, matchedPatterns } = await scoreText(body, 'sms');

    const isSpam = !!spamRecord || score >= SPAM_THRESHOLD;

    if (isSpam) {
      const reason = spamRecord
        ? `Matched known ${spamRecord.category} number`
        : `Matched spam patterns: ${matchedPatterns.join(', ')}`;

      const item = await saveBlockedItem({
        channel: 'sms',
        sender: number,
        reason,
        contentSnippet: body.slice(0, 200),
      });
      return res.json({ isSpam: true, action: 'block', blockedItem: item });
    }

    return res.json({ isSpam: false, action: 'allow' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error checking SMS' });
  }
}

/**
 * POST /api/check-email
 * body: { from: string, subject: string, snippet: string }
 * Called by the Gmail scan job (Day 5).
 */
async function checkEmail(req, res) {
  try {
    const { from, subject, snippet } = req.body;
    if (!from) return res.status(400).json({ error: 'from is required' });

    const normalizedFrom = resolveSenderIdentity('email', from).senderId;

    if (await isWhitelisted(normalizedFrom)) {
      return res.json({ isSpam: false, action: 'allow', reason: 'whitelisted' });
    }

    const combinedText = `${subject || ''} ${snippet || ''}`;
    const { score, matchedPatterns } = await scoreText(combinedText, 'email');

    const isSpam = score >= SPAM_THRESHOLD;

    if (isSpam) {
      const item = await saveBlockedItem({
        channel: 'email',
        sender: from,
        reason: `Matched spam patterns: ${matchedPatterns.join(', ')}`,
        contentSnippet: (subject || snippet || '').slice(0, 200),
      });
      return res.json({ isSpam: true, action: 'block', blockedItem: item });
    }

    return res.json({ isSpam: false, action: 'allow' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error checking email' });
  }
}

module.exports = { checkCall, checkSms, checkEmail, saveBlockedItem, isWhitelisted };
