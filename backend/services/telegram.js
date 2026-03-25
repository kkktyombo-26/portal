/**
 * notifier/telegram.js
 * ─────────────────────────────────────────────────────────────────
 * Sends live stream notifications to one or more Telegram groups
 * or channels via the Telegram Bot API.
 *
 * SETUP (5 minutes):
 *   1. Open Telegram → search @BotFather
 *   2. Send /newbot → follow prompts → copy the token
 *   3. Add your bot to the church group(s) as an admin
 * 
 *   4. Get the chat ID:
 *      - Send a message in the group
 *      - Visit: https://api.telegram.org/bot<TOKEN>/getUpdates
 *      - Find "chat":{"id": -XXXXXXXXX}  ← that's your chat ID
 *   5. Add to .env:
 *      TELEGRAM_BOT_TOKEN=your_bot_token
 *      TELEGRAM_CHAT_IDS=-100123456789,-100987654321
 *      (comma-separated for multiple groups)
 *
 * Dependencies:
 *   npm install node-telegram-bot-api
 * ─────────────────────────────────────────────────────────────────
 */

require("dotenv").config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Parse comma-separated chat IDs from env
// e.g. TELEGRAM_CHAT_IDS=-100123456789,-100987654321
const CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

/**
 * sendTelegram(message, stream)
 *
 * Sends a formatted message to all configured Telegram groups.
 * Uses the Telegram HTTP API directly (no library dependency).
 *
 * @param {string} message  - Markdown-formatted message text
 * @param {object} stream   - { videoId, title, url, thumbUrl }
 */
async function sendTelegram(message, stream) {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN not set in .env");
  }
  if (!CHAT_IDS.length) {
    throw new Error("TELEGRAM_CHAT_IDS not set in .env — add at least one chat ID");
  }

  const results = await Promise.allSettled(
    CHAT_IDS.map((chatId) => sendToChat(chatId, message, stream))
  );

  // Report per-chat results
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[Telegram] Failed to send to chat ${CHAT_IDS[i]}: ${r.reason?.message}`);
    }
  });

  // Throw if ALL chats failed
  if (results.every((r) => r.status === "rejected")) {
    throw new Error("All Telegram chats failed to receive the notification");
  }
}

async function sendToChat(chatId, message, stream) {
  const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

  // Send thumbnail photo + caption if available, otherwise text only
  if (stream?.thumbUrl) {
    const res = await fetch(`${BASE}/sendPhoto`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        photo:      stream.thumbUrl,
        caption:    message,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram API: ${data.description}`);
    return data;
  }

  // Text-only fallback
  const res = await fetch(`${BASE}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:                  chatId,
      text:                     message,
      parse_mode:               "Markdown",
      disable_web_page_preview: false, // show YouTube link preview
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram API: ${data.description}`);
  return data;
}

/**
 * sendTelegramText(text)
 * Utility — send a plain text message to all groups.
 * Useful for admin alerts, error reports, etc.
 */
async function sendTelegramText(text) {
  return sendTelegram(text, null);
}

/**
 * testTelegram()
 * Run this to verify your bot token and chat IDs are working:
 *   node -e "require('./notifier/telegram').testTelegram()"
 */
async function testTelegram() {
  console.log("[Telegram] Sending test message...");
  await sendTelegramText(
    "✅ *Church YouTube Notifier — Test Message*\n\n" +
    "This is a test from the live stream notification system. " +
    "If you see this, Telegram notifications are working correctly."
  );
  console.log("[Telegram] Test message sent successfully.");
}

module.exports = { sendTelegram, sendTelegramText, testTelegram };