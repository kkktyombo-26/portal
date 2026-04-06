const nodemailer = require('nodemailer');
const dotenv = require("dotenv");
dotenv.config();

// ─────────────────────────────────────────────
// Transporter (Gmail SMTP + App Password)
// ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

transporter.verify((error) => {
  if (error) {
    console.error('❌ Gmail SMTP connection failed:', error.message);
  } else {
    console.log('✅ Gmail SMTP ready — KKKT Yombo DMP');
  }
});

// ─────────────────────────────────────────────
// Branding
// ─────────────────────────────────────────────
const LOGO_URL    = 'https://res.cloudinary.com/dcka18xuw/image/upload/v1775397623/luther_rb1fbu.webp';
const CHURCH_NAME = 'KKKT Yombo DMP';
const NAVY        = '#1B3A6B';   // from portal design system
const GOLD        = '#B8860B';   // from portal design system
const GOLD_LIGHT  = '#F5F0E8';   // parchment / gold-light

// ─────────────────────────────────────────────
// Base HTML wrapper
// ─────────────────────────────────────────────
function baseTemplate(title, bodyHtml) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,'Times New Roman',serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10);">

          <!-- Header: deep navy -->
          <tr>
            <td style="background:${NAVY};padding:28px 32px;text-align:center;">
              <img
                src="${LOGO_URL}"
                alt="${CHURCH_NAME}"
                width="80"
                style="display:block;margin:0 auto 12px;height:auto;object-fit:contain;"
              />
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">${CHURCH_NAME}</p>
              <p style="margin:4px 0 0;color:#a0aec0;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Kanisa la Kiinjili la Kilutheri Tanzania</p>
            </td>
          </tr>

          <!-- Gold accent strip -->
          <tr>
            <td style="background:${GOLD};height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;font-family:Arial,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;font-family:Arial,sans-serif;">
                &copy; ${new Date().getFullYear()} ${CHURCH_NAME} &bull; Yombo, Dar es Salaam, Tanzania<br/>
                Mawasiliano: <a href="mailto:${process.env.GMAIL_USER}" style="color:${GOLD};">${process.env.GMAIL_USER}</a>
              </p>
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
}

// ─────────────────────────────────────────────
// Core send function
// ─────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const info = await transporter.sendMail({
    from: `"${CHURCH_NAME}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text: text || subject
  });
  console.log(`📧 [${subject}] → ${to} | ID: ${info.messageId}`);
  return info;
}


// ═══════════════════════════════════════════════════════════
// 1. OTP / MEMBER VERIFICATION
// ═══════════════════════════════════════════════════════════

/**
 * Send OTP verification code to a church member
 * @param {string} to
 * @param {string} otp
 * @param {string} purpose   - 'login' | 'signup' | 'reset_password' | 'verify_email'
 * @param {number} expiresIn - minutes (default: 10)
 */
async function sendOTP(to, otp, purpose = 'login', expiresIn = 10) {
  const labels = {
    login:          { en: 'Login Verification Code',   sw: 'Nambari ya Uthibitisho wa Kuingia' },
    signup:         { en: 'Member Registration Code',  sw: 'Thibitisha Usajili Wako' },
    reset_password: { en: 'Password Reset Code',       sw: 'Nambari ya Kubadilisha Nenosiri' },
    verify_email:   { en: 'Verify Your Email',         sw: 'Thibitisha Barua Pepe Yako' },
  };
  const label = labels[purpose] || labels.login;

  const body = `
    <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">${label.en}</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${label.sw}</p>

    <p style="color:#374151;font-size:15px;margin:0 0 24px;">
      Ndugu mwanakamati, tumia nambari hii kukamilisha hatua yako kwenye mfumo wa ${CHURCH_NAME}:
    </p>

    <!-- OTP Box -->
    <div style="text-align:center;margin:0 0 28px;">
      <div style="display:inline-block;background:${GOLD_LIGHT};border:2px dashed ${GOLD};border-radius:12px;padding:20px 48px;">
        <span style="font-size:42px;font-weight:800;letter-spacing:14px;color:${NAVY};">${otp}</span>
      </div>
    </div>

    <p style="color:#ef4444;font-size:13px;margin:0 0 8px;">
      ⏱ Nambari hii itakwisha baada ya dakika <strong>${expiresIn}</strong>.
    </p>
    <p style="color:#9ca3af;font-size:13px;margin:0;">
      Kama hukuomba nambari hii, pumzika — akaunti yako iko salama. Wasiliana nasi iwapo una wasiwasi.
    </p>
  `;

  return sendEmail({
    to,
    subject: `${otp} — ${label.en} | ${CHURCH_NAME}`,
    html: baseTemplate(label.en, body)
  });
}


// ═══════════════════════════════════════════════════════════
// 2. MEMBER WELCOME EMAIL (after registration)
// ═══════════════════════════════════════════════════════════

/**
 * Send welcome email after a member registers
 * @param {string} to
 * @param {object} member - { memberName, role, congregationGroup }
 */
async function sendWelcomeEmail(to, { memberName, role = 'Mwanakamati', congregationGroup = '' }) {
  const body = `
    <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">Karibu ${CHURCH_NAME}! 🙏</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Welcome to the Church Portal</p>

    <p style="color:#374151;font-size:15px;margin:0 0 16px;">
      Habari <strong>${memberName}</strong>,<br/>
      Akaunti yako kwenye mfumo wa kanisa imefunguliwa kikamilifu. Tunafurahi kukuwa nawe!
    </p>

    <div style="background:${GOLD_LIGHT};border-left:4px solid ${GOLD};padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Wadhifa wako / Your Role</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:${NAVY};">${role}</p>
      ${congregationGroup ? `<p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Kikundi: <strong style="color:#374151;">${congregationGroup}</strong></p>` : ''}
    </div>

    <p style="color:#374151;font-size:14px;margin:0 0 8px;">Unaweza kuanza:</p>
    <ul style="color:#374151;font-size:14px;margin:0 0 24px;padding-left:20px;line-height:2;">
      <li>Kuangalia matukio ya kanisa</li>
      <li>Kutoa zaka na sadaka kwa njia ya mfumo</li>
      <li>Kutuma maombi ya sala</li>
      <li>Kupata habari na matangazo ya kanisa</li>
    </ul>

    <a href="${process.env.APP_SCHEME || '#'}://open"
      style="display:inline-block;background:${NAVY};color:#ffffff;padding:12px 28px;border-radius:6px;font-weight:700;text-decoration:none;font-size:14px;">
      Ingia Mfumoni →
    </a>

    <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">
      Mungu akubariki katika huduma yako. 🙏
    </p>
  `;

  return sendEmail({
    to,
    subject: `Karibu — Akaunti Yako Iko Tayari | ${CHURCH_NAME}`,
    html: baseTemplate('Karibu!', body)
  });
}


// ═══════════════════════════════════════════════════════════
// 3. TITHE / OFFERING RECEIPT
// ═══════════════════════════════════════════════════════════

/**
 * Send tithe/offering receipt to a member
 * @param {string} to
 * @param {object} receipt - { memberName, memberNo, type, amount, currency, transactionId, date, receivedBy }
 *   type: 'Zaka' | 'Sadaka' | 'Matoleo' | 'Ujenzi' | 'Michango'
 */
async function sendTitheReceipt(to, receipt) {
  const {
    memberName, memberNo = '', type = 'Sadaka',
    amount, currency = 'TZS', transactionId,
    date, receivedBy = ''
  } = receipt;

  const body = `
    <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">Risiti ya ${type} ✅</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Offering / Tithe Receipt</p>

    <p style="color:#374151;font-size:15px;margin:0 0 20px;">
      Ndugu <strong>${memberName}</strong>,<br/>
      Matoleo yako yamepokewa na kusajiliwa. Asante kwa ukarimu wako kwa Mungu na kanisa.
    </p>

    <!-- Receipt Table -->
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      ${[
        ['Aina ya Mchango / Type',   type],
        ['Kiasi / Amount',           `${currency} ${Number(amount).toLocaleString()}`],
        ['Tarehe / Date',            date],
        ['Nambari ya Muumini',       memberNo || 'N/A'],
        ['Aliyepokea / Received By', receivedBy || 'Hazina ya Kanisa'],
        ['Nambari ya Risiti',        `#${transactionId}`],
      ].map(([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:45%;">${label}</td>
          <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;">${value}</td>
        </tr>
      `).join('')}
    </table>

    <div style="background:${GOLD_LIGHT};border-left:4px solid ${GOLD};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#374151;font-style:italic;">
        "Kila mmoja na atoe kama alivyokusudia moyoni mwake; si kwa huzuni, wala si kwa kulazimishwa; 
        kwa maana Mungu hupenda mtu anayetoa kwa furaha." — 2 Wakorintho 9:7
      </p>
    </div>

    <p style="color:#9ca3af;font-size:13px;margin:0;">
      Hifadhi barua pepe hii kama risiti yako rasmi. Mungu akubariki. 🙏
    </p>
  `;

  return sendEmail({
    to,
    subject: `Risiti ya ${type} #${transactionId} | ${CHURCH_NAME}`,
    html: baseTemplate(`Risiti ya ${type}`, body)
  });
}


// ═══════════════════════════════════════════════════════════
// 4. EVENT REMINDERS & ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════

/**
 * Send event reminder / announcement to members
 * @param {string|string[]} to
 * @param {object} event - { title, titleSwahili, date, time, location, description, type, ctaLabel, ctaUrl }
 *   type: 'ibada' | 'mkutano' | 'semina' | 'sherehe' | 'matangazo'
 */
async function sendEventAnnouncement(to, event) {
  const {
    title, titleSwahili = '', date, time = '',
    location = '', description, type = 'matangazo',
    ctaLabel = '', ctaUrl = ''
  } = event;

  const icons = {
    ibada:      '⛪',
    mkutano:    '📋',
    semina:     '📚',
    sherehe:    '🎉',
    matangazo:  '📢',
  };
  const icon = icons[type] || '📢';

  const body = `
    <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">${icon} ${title}</h2>
    ${titleSwahili ? `<p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${titleSwahili}</p>` : '<div style="margin-bottom:24px;"></div>'}

    <!-- Event details card -->
    <div style="background:${GOLD_LIGHT};border-radius:8px;padding:20px;margin-bottom:24px;">
      ${date ? `
      <div style="display:flex;gap:12px;margin-bottom:12px;align-items:center;">
        <span style="font-size:20px;">📅</span>
        <div>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Tarehe / Date</p>
          <p style="margin:2px 0 0;font-size:15px;font-weight:700;color:${NAVY};">${date}${time ? ` — ${time}` : ''}</p>
        </div>
      </div>` : ''}
      ${location ? `
      <div style="display:flex;gap:12px;align-items:center;">
        <span style="font-size:20px;">📍</span>
        <div>
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Mahali / Location</p>
          <p style="margin:2px 0 0;font-size:15px;font-weight:700;color:${NAVY};">${location}</p>
        </div>
      </div>` : ''}
    </div>

    <div style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:28px;">
      ${description}
    </div>

    ${ctaLabel && ctaUrl ? `
    <a href="${ctaUrl}"
      style="display:inline-block;background:${NAVY};color:#ffffff;padding:12px 28px;border-radius:6px;font-weight:700;text-decoration:none;font-size:14px;">
      ${ctaLabel} →
    </a>` : ''}
  `;

  return sendEmail({
    to,
    subject: `${icon} ${title} | ${CHURCH_NAME}`,
    html: baseTemplate(title, body)
  });
}


// ═══════════════════════════════════════════════════════════
// 5. PRAYER REQUESTS & SPIRITUAL SUPPORT
// ═══════════════════════════════════════════════════════════

/**
 * Send prayer request confirmation to the member
 * @param {string} to
 * @param {object} prayer - { memberName, requestId, subject, message, isPrivate }
 */
async function sendPrayerRequestConfirmation(to, { memberName, requestId, subject, message, isPrivate = false }) {
  const body = `
    <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">Ombi Lako la Sala Limepokelewa 🙏</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Prayer Request Received</p>

    <p style="color:#374151;font-size:15px;margin:0 0 20px;">
      Ndugu <strong>${memberName}</strong>,<br/>
      Ombi lako la sala limefika kwetu. Viongozi wa kanisa wataomba pamoja nawe.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      ${[
        ['Nambari ya Ombi',  `#${requestId}`],
        ['Mada / Subject',   subject],
        ['Hali / Privacy',   isPrivate ? '🔒 Siri (Wachungaji tu)' : '🌐 Jumuiya nzima'],
        ['Tarehe',           new Date().toLocaleDateString('sw-TZ')],
      ].map(([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:40%;">${label}</td>
          <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;">${value}</td>
        </tr>
      `).join('')}
    </table>

    <div style="background:#f0f4ff;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Ombi Lako</p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${message}</p>
    </div>

    <div style="background:${GOLD_LIGHT};border-left:4px solid ${GOLD};padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#374151;font-style:italic;">
        "Ombeni, nanyi mtapewa; tafuteni, nanyi mtaona; bisheni, nanyi mtafunguliwa." — Mathayo 7:7
      </p>
    </div>

    <p style="color:#9ca3af;font-size:13px;margin:0;">
      Kama ombi lako ni la dharura, wasiliana moja kwa moja na Mchungaji wako.
      Mungu akusikii. 🙏
    </p>
  `;

  return sendEmail({
    to,
    subject: `🙏 Ombi la Sala #${requestId} Limepokelewa | ${CHURCH_NAME}`,
    html: baseTemplate('Ombi la Sala', body)
  });
}

/**
 * Forward prayer request to pastor / prayer team
 * @param {object} prayer - { memberName, memberEmail, requestId, subject, message, isPrivate }
 */
async function forwardPrayerRequestToAdmin({ memberName, memberEmail, requestId, subject, message, isPrivate }) {
  const adminEmail = process.env.SUPPORT_EMAIL || process.env.GMAIL_USER;

  const body = `
    <h2 style="margin:0 0 24px;color:#111827;font-size:20px;">🙏 Ombi Jipya la Sala #${requestId}</h2>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      ${[
        ['Kutoka / From',  `${memberName} &lt;${memberEmail}&gt;`],
        ['Mada',          subject],
        ['Hali',          isPrivate ? '🔒 Siri' : '🌐 Wazi'],
        ['Wakati',        new Date().toISOString()],
      ].map(([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;width:30%;">${label}</td>
          <td style="padding:12px 16px;font-size:13px;color:#111827;">${value}</td>
        </tr>
      `).join('')}
    </table>

    <div style="background:#f9fafb;border-radius:8px;padding:16px;">
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">UJUMBE WA OMBI</p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${message}</p>
    </div>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `🙏 Ombi la Sala #${requestId} — ${memberName}`,
    html: baseTemplate(`Ombi #${requestId}`, body)
  });
}


// ═══════════════════════════════════════════════════════════
// 6. GENERAL NOTIFICATION / ANNOUNCEMENT
// ═══════════════════════════════════════════════════════════

/**
 * Send a general church notification
 * @param {string|string[]} to
 * @param {object} alert - { title, titleSwahili, message, type, ctaLabel, ctaUrl }
 *   type: 'info' | 'warning' | 'success' | 'danger'
 */
async function sendNotification(to, { title, titleSwahili, message, type = 'info', ctaLabel, ctaUrl }) {
  const styles = {
    info:    { color: NAVY,      bg: '#EBF0F8', icon: 'ℹ️' },
    warning: { color: '#B45309', bg: '#fffbeb', icon: '⚠️' },
    success: { color: '#166534', bg: '#f0fdf4', icon: '✅' },
    danger:  { color: '#B91C1C', bg: '#fef2f2', icon: '🚨' },
  };
  const s = styles[type] || styles.info;

  const body = `
    <h2 style="margin:0 0 4px;color:#111827;font-size:20px;">${s.icon} ${title}</h2>
    ${titleSwahili ? `<p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${titleSwahili}</p>` : '<div style="margin-bottom:24px;"></div>'}

    <div style="background:${s.bg};border-left:4px solid ${s.color};padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${message}</p>
    </div>

    ${ctaLabel && ctaUrl ? `
    <a href="${ctaUrl}"
      style="display:inline-block;background:${NAVY};color:#ffffff;padding:12px 28px;border-radius:6px;font-weight:700;text-decoration:none;font-size:14px;">
      ${ctaLabel} →
    </a>` : ''}
  `;

  return sendEmail({
    to,
    subject: `${s.icon} ${title} | ${CHURCH_NAME}`,
    html: baseTemplate(title, body)
  });
}


// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────
module.exports = {
  // Core
  sendEmail,

  // Member auth
  sendOTP,
  sendWelcomeEmail,

  // Finance
  sendTitheReceipt,

  // Events
  sendEventAnnouncement,

  // Prayer & Support
  sendPrayerRequestConfirmation,
  forwardPrayerRequestToAdmin,

  // General
  sendNotification,
};