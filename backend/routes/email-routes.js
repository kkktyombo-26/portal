const express = require('express');
const router  = express.Router();
const {
  sendOTP,
  sendWelcomeEmail,
  sendTitheReceipt,
  sendEventAnnouncement,
  sendPrayerRequestConfirmation,
  forwardPrayerRequestToAdmin,
  sendNotification,
} = require('../services/emailService');

// ─── helpers ──────────────────────────────────────────────
function ok(res, message)  { return res.json({ success: true, message }); }
function fail(res, error)  { return res.status(500).json({ success: false, error: error.message }); }
function bad(res, message) { return res.status(400).json({ success: false, error: message }); }


// ═══════════════════════════════════════════════════════════
// AUTH EMAILS
// ═══════════════════════════════════════════════════════════

/**
 * POST /emails/otp
 * Body: { to, otp, purpose, expiresIn }
 * purpose: 'login' | 'signup' | 'reset_password' | 'verify_email'
 */
router.post('/otp', async (req, res) => {
  const { to, otp, purpose = 'login', expiresIn = 10 } = req.body;
  if (!to || !otp) return bad(res, 'to and otp are required');
  try {
    await sendOTP(to, otp, purpose, expiresIn);
    ok(res, 'OTP sent');
  } catch (e) { fail(res, e); }
});

/**
 * POST /emails/welcome
 * Body: { to, memberName, role, congregationGroup }
 */
router.post('/welcome', async (req, res) => {
  const { to, memberName, role, congregationGroup } = req.body;
  if (!to || !memberName) return bad(res, 'to and memberName are required');
  try {
    await sendWelcomeEmail(to, { memberName, role, congregationGroup });
    ok(res, 'Welcome email sent');
  } catch (e) { fail(res, e); }
});


// ═══════════════════════════════════════════════════════════
// FINANCE
// ═══════════════════════════════════════════════════════════

/**
 * POST /emails/tithe-receipt
 * Body: { to, receipt: { memberName, memberNo, type, amount, currency, transactionId, date, receivedBy } }
 * type: 'Zaka' | 'Sadaka' | 'Matoleo' | 'Ujenzi' | 'Michango'
 */
router.post('/tithe-receipt', async (req, res) => {
  const { to, receipt } = req.body;
  if (!to || !receipt) return bad(res, 'to and receipt are required');
  if (!receipt.amount || !receipt.transactionId) return bad(res, 'receipt.amount and receipt.transactionId are required');
  try {
    await sendTitheReceipt(to, receipt);
    ok(res, 'Tithe receipt sent');
  } catch (e) { fail(res, e); }
});


// ═══════════════════════════════════════════════════════════
// EVENTS & ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /emails/event
 * Body: {
 *   to,           // string | string[]
 *   title,        // required
 *   titleSwahili,
 *   date,
 *   time,
 *   location,
 *   description,  // required
 *   type,         // 'ibada' | 'mkutano' | 'semina' | 'sherehe' | 'matangazo'
 *   ctaLabel,
 *   ctaUrl
 * }
 */
router.post('/event', async (req, res) => {
  const { to, ...eventData } = req.body;
  if (!to || !eventData.title || !eventData.description)
    return bad(res, 'to, title, and description are required');
  try {
    await sendEventAnnouncement(to, eventData);
    ok(res, 'Event announcement sent');
  } catch (e) { fail(res, e); }
});


// ═══════════════════════════════════════════════════════════
// PRAYER REQUESTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /emails/prayer
 * Body: { to, memberEmail, memberName, requestId, subject, message, isPrivate }
 * Sends confirmation to member AND forwards to admin/pastor inbox simultaneously.
 */
router.post('/prayer', async (req, res) => {
  const { to, memberEmail, ...prayerData } = req.body;
  if (!to || !prayerData.requestId || !prayerData.subject)
    return bad(res, 'to, requestId, and subject are required');
  try {
    await Promise.all([
      sendPrayerRequestConfirmation(to, prayerData),
      forwardPrayerRequestToAdmin({ ...prayerData, memberEmail: memberEmail || to }),
    ]);
    ok(res, 'Prayer request emails sent');
  } catch (e) { fail(res, e); }
});


// ═══════════════════════════════════════════════════════════
// GENERAL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

/**
 * POST /emails/notify
 * Body: { to, title, titleSwahili, message, type, ctaLabel, ctaUrl }
 * type: 'info' | 'warning' | 'success' | 'danger'
 */
router.post('/notify', async (req, res) => {
  const { to, ...alertData } = req.body;
  if (!to || !alertData.title || !alertData.message)
    return bad(res, 'to, title, and message are required');
  try {
    await sendNotification(to, alertData);
    ok(res, 'Notification sent');
  } catch (e) { fail(res, e); }
});


module.exports = router;