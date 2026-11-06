/**
 * services/smsService.js
 * ──────────────────────
 * NextSMS API wrapper — plain HTTP, no SDK required.
 * Base URL: https://messaging-service.co.tz
 *
 * Required .env keys:
 *   NEXTSMS_API_TOKEN    — from nextsms.co.tz dashboard:
 *                          Customer Profile → Customization → API Keys
 *   NEXTSMS_SENDER_ID   — your approved Sender ID, e.g. KKKT
 *                          (request it in the dashboard under Sender IDs)
 */

const NEXTSMS_BASE = 'https://messaging-service.co.tz';

/**
 * sendSMS
 * Sends a plain SMS via NextSMS to one phone number.
 *
 * @param {string} to      - Phone in 255XXXXXXXXX format (no + sign)
 * @param {string} message - Plain text message body
 * @returns {Promise<object>} NextSMS API response
 * @throws  Error if the HTTP request fails or NextSMS rejects the message
 */
async function sendSMS(to, message) {
  const token    = process.env.NEXTSMS_API_TOKEN;
  const senderId = process.env.NEXTSMS_SENDER_ID;

  if (!token)    throw new Error('NEXTSMS_API_TOKEN is not set in .env');
  if (!senderId) throw new Error('NEXTSMS_SENDER_ID is not set in .env');

  const response = await fetch(`${NEXTSMS_BASE}/api/sms/v2/text/single`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept':        'application/json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from: senderId,
      to:   to,
      text: message,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Surface the NextSMS error message clearly in logs
    throw new Error(
      `NextSMS HTTP ${response.status}: ${data.message ?? JSON.stringify(data)}`
    );
  }

  // Check the per-recipient status in the response
  // NextSMS always returns 200, even for rejected numbers —
  // so we must inspect the status ourselves.
  const result = data?.messages?.[0];
  if (result && result.status?.groupName === 'REJECTED') {
    throw new Error(
      `NextSMS rejected number ${to}: ${result.status.name} — ${result.status.description}`
    );
  }

  return data;
}

module.exports = { sendSMS };