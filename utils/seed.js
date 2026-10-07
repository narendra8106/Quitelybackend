/**
 * Run with: node utils/seed.js
 * Populates SpamNumber and SpamKeywordPattern collections with starter
 * data so call/SMS/email checking works immediately without waiting
 * on a real crowd-sourced dataset.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const SpamNumber = require('../models/SpamNumber');
const SpamKeywordPattern = require('../models/SpamKeywordPattern');

const spamNumbers = [
  { number: '911234567890', category: 'telemarketer', reportCount: 42 },
  { number: '919999999999', category: 'scam', reportCount: 128 },
  { number: '18005551234', category: 'robocall', reportCount: 15 },
  { number: '917000012345', category: 'fraud', reportCount: 67 },

];

const keywordPatterns = [
  { pattern: 'click here', weight: 2, appliesTo: 'both' },
  { pattern: 'loan approved', weight: 3, appliesTo: 'both' },
  { pattern: 'you have won', weight: 3, appliesTo: 'both' },
  { pattern: 'verify your account', weight: 2, appliesTo: 'both' },
  { pattern: 'act now', weight: 2, appliesTo: 'both' },
  { pattern: 'limited time offer', weight: 2, appliesTo: 'both' },
  { pattern: 'congratulations', weight: 2, appliesTo: 'both' },
  { pattern: 'urgent action required', weight: 3, appliesTo: 'both' },
  { pattern: 'wire transfer', weight: 2, appliesTo: 'email' },
  { pattern: 'crypto investment', weight: 3, appliesTo: 'both' },
  { pattern: 'free gift', weight: 2, appliesTo: 'both' },
  { pattern: 'kyc update', weight: 2, appliesTo: 'both' },
];

async function seed() {
  await connectDB();

  await SpamNumber.deleteMany({});
  await SpamKeywordPattern.deleteMany({});

  await SpamNumber.insertMany(spamNumbers);
  await SpamKeywordPattern.insertMany(keywordPatterns);

  console.log(`Seeded ${spamNumbers.length} spam numbers and ${keywordPatterns.length} keyword patterns.`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
