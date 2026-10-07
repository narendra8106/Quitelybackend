/**
 * Normalizes a phone number to digits only, so "+91 98765-43210",
 * "9876543210", and "(98765) 43210" all resolve to the same senderId.
 */
function normalizePhoneNumber(raw) {
  if (!raw) return null;
  return raw.replace(/\D/g, '');
}

/**
 * Normalizes an email address to lowercase, trimmed.
 */
function normalizeEmail(raw) {
  if (!raw) return null;
  return raw.trim().toLowerCase();
}

/**
 * Extracts the domain portion of an email address.
 */
function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase();
}

/**
 * Given a channel and raw sender string, returns { senderId, senderDomain }
 * ready to store on a BlockedItem.
 */
function resolveSenderIdentity(channel, rawSender) {
  if (channel === 'email') {
    const senderId = normalizeEmail(rawSender);
    return { senderId, senderDomain: extractDomain(senderId) };
  }
  // call and sms both use phone numbers
  const senderId = normalizePhoneNumber(rawSender);
  return { senderId, senderDomain: null };
}

module.exports = {
  normalizePhoneNumber,
  normalizeEmail,
  extractDomain,
  resolveSenderIdentity,
};
