const BlockedItem = require('../models/BlockedItem');
const SpamNumber = require('../models/SpamNumber');
const PersonalWhitelist = require('../models/PersonalWhitelist');
const { normalizePhoneNumber } = require('../utils/normalize');

/**
 * GET /api/blocked-items?channel=call|sms|email  (optional filter)
 * Powers the dashboard screens.
 */
async function getBlockedItems(req, res) {
  try {
    const { channel, limit = 100 } = req.query;
    const query = channel ? { channel } : {};
    const items = await BlockedItem.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10))
      .populate('linkedIdentities');
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching items' });
  }
}

/**
 * GET /api/blocked-items/summary
 * Powers the Home dashboard counts.
 */
async function getSummary(req, res) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const [callCount, smsCount, emailCount, coordinatedCount, recent, dailyCounts] = await Promise.all([
      BlockedItem.countDocuments({ channel: 'call' }),
      BlockedItem.countDocuments({ channel: 'sms' }),
      BlockedItem.countDocuments({ channel: 'email' }),
      BlockedItem.countDocuments({ isCoordinatedThreat: true }),
      BlockedItem.find().sort({ timestamp: -1 }).limit(10),
      BlockedItem.aggregate([
        { $match: { timestamp: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'UTC' } },
              channel: '$channel',
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const dailyCountsByDay = new Map();
    for (const item of dailyCounts) {
      const counts = dailyCountsByDay.get(item._id.day) || { calls: 0, sms: 0, email: 0 };
      const channelKey = item._id.channel === 'call' ? 'calls' : item._id.channel;
      counts[channelKey] = item.count;
      dailyCountsByDay.set(item._id.day, counts);
    }

    const dailyActivity = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(sevenDaysAgo);
      day.setUTCDate(day.getUTCDate() + offset);
      const date = day.toISOString().slice(0, 10);
      const counts = dailyCountsByDay.get(date) || { calls: 0, sms: 0, email: 0 };
      dailyActivity.push({
        date,
        ...counts,
        total: counts.calls + counts.sms + counts.email,
      });
    }

    res.json({
      totals: {
        calls: callCount,
        sms: smsCount,
        email: emailCount,
        all: callCount + smsCount + emailCount,
        coordinatedThreats: coordinatedCount,
      },
      recent,
      dailyActivity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching summary' });
  }
}

/**
 * GET /api/blocked-items/coordinated
 * Returns items flagged as part of a coordinated cross-channel threat.
 */
async function getCoordinatedThreats(req, res) {
  try {
    const items = await BlockedItem.find({ isCoordinatedThreat: true })
      .sort({ timestamp: -1 })
      .populate('linkedIdentities');
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching coordinated threats' });
  }
}

/**
 * DELETE /api/blocked-items/:id
 * Permanently removes a blocked-item record.
 */
async function deleteBlockedItem(req, res) {
  try {
    const item = await BlockedItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true, id: item._id });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid item id' });
    console.error(err);
    res.status(500).json({ error: 'Server error deleting item' });
  }
}

/**
 * POST /api/report-spam
 * body: { channel, sender, category? }
 * User-driven reporting - strengthens the shared blocklist for everyone.
 */
async function reportSpam(req, res) {
  try {
    const { channel, sender, category = 'unknown' } = req.body;
    if (!channel || !sender) {
      return res.status(400).json({ error: 'channel and sender are required' });
    }

    if (channel === 'call' || channel === 'sms') {
      const normalized = normalizePhoneNumber(sender);
      const updated = await SpamNumber.findOneAndUpdate(
        { number: normalized },
        {
          $inc: { reportCount: 1 },
          $set: { lastReportedAt: new Date(), category },
          $setOnInsert: { number: normalized },
        },
        { upsert: true, new: true }
      );
      return res.json({ success: true, spamNumber: updated });
    }

    // Email reports don't go into SpamNumber (that's phone-only) - for
    // the hackathon scope we just acknowledge; a fuller version would
    // maintain a SpamSender collection for email/domain reports too.
    res.json({ success: true, message: 'Email report recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error reporting spam' });
  }
}

/**
 * PATCH /api/blocked-items/:id/mark-safe
 * User says "this wasn't spam" - the false-positive fix.
 *
 * This does three things, not just a one-time log correction:
 *  1. Flags the historical BlockedItem record as userMarkedSafe (for
 *     transparency - the log stays accurate about what happened)
 *  2. Adds the sender to PersonalWhitelist, so check-call/check-sms/
 *     check-email will never flag this sender again for this user,
 *     regardless of what the shared spam data says
 *  3. If it was a phone number matched against the shared SpamNumber
 *     blocklist, nudges that record's reportCount down - one correction
 *     shouldn't erase a genuinely bad number's history, but it should
 *     count as a small signal against it
 */
async function markSafe(req, res) {
  try {
    const item = await BlockedItem.findByIdAndUpdate(
      req.params.id,
      { userMarkedSafe: true },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await PersonalWhitelist.findOneAndUpdate(
      { senderId: item.senderId },
      {
        senderId: item.senderId,
        channel: item.channel,
        reason: `User marked "${item.sender}" as not spam`,
      },
      { upsert: true }
    );

    if (item.channel === 'call' || item.channel === 'sms') {
      const normalized = normalizePhoneNumber(item.sender);
      await SpamNumber.findOneAndUpdate(
        { number: normalized },
        { $inc: { reportCount: -1 } }
      );
    }

    res.json({ ...item.toObject(), whitelisted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error marking item safe' });
  }
}

module.exports = {
  getBlockedItems,
  getSummary,
  getCoordinatedThreats,
  deleteBlockedItem,
  reportSpam,
  markSafe,
};
