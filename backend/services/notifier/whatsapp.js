/**
 * notifier/whatsapp.js
 * Uses Meta WhatsApp Business API (Cloud API) — free, no Twilio needed.
 *
 * SETUP:
 *   1. Go to https://developers.facebook.com → Create App → Business
 *   2. Add "WhatsApp" product to your app
 *   3. Under WhatsApp → Getting Started, note your:
 *        - Phone Number ID  (WHATSAPP_PHONE_NUMBER_ID)
 *        - Test number or add your own verified number
 *   4. Generate a permanent System User Token:
 *        Business Settings → System Users → Add → generate token
 *        (grant whatsapp_business_messaging permission)
 *   5. Create a message template:
 *        WhatsApp → Message Templates → Create
 *        Example body: "🔴 {{1}} is live now! Watch here: {{2}}"
 *        Category: MARKETING or UTILITY — submit for approval
 *   6. Add to .env:
 *        META_ACCESS_TOKEN=your_system_user_token
 *        WHATSAPP_PHONE_NUMBER_ID=123456789012345
 *        WHATSAPP_TEMPLATE_NAME=church_live_stream
 *        WHATSAPP_TEMPLATE_LANG=en_US
 *        WHATSAPP_RECIPIENTS=+255712345678,+255787654321
 */

require("dotenv").config();
const https = require("https");

const ACCESS_TOKEN   = process.env.META_ACCESS_TOKEN;
const PHONE_NUM_ID   = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TEMPLATE_NAME  = process.env.WHATSAPP_TEMPLATE_NAME;
const TEMPLATE_LANG  = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

const RECIPIENTS = (process.env.WHATSAPP_RECIPIENTS || "")
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean);

const API_VERSION = "v19.0";

/**
 * Low-level POST to Meta Graph API (no extra deps needed).
 */
function graphPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "graph.facebook.com",
        path: `/${API_VERSION}/${path}`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(raw);
            if (json.error) reject(new Error(json.error.message));
            else resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/**
 * sendWhatsApp(message, stream)
 *
 * Sends a WhatsApp template message to all configured recipients.
 *
 * @param {string} message  - Full notification text (used as template param)
 * @param {object} stream   - { videoId, title, url, thumbUrl }
 *
 * Template example: "🔴 {{1}} is live now! Watch here: {{2}}"
 *   → param 1 = stream.title
 *   → param 2 = stream.url
 */

async function sendWhatsApp(message, stream) {
  if (!ACCESS_TOKEN)  throw new Error("META_ACCESS_TOKEN not set in .env");
  if (!PHONE_NUM_ID)  throw new Error("WHATSAPP_PHONE_NUMBER_ID not set in .env");
  if (!TEMPLATE_NAME) throw new Error("WHATSAPP_TEMPLATE_NAME not set in .env");
  if (!RECIPIENTS.length) throw new Error("WHATSAPP_RECIPIENTS not set in .env");

  // Use header image only when stream has a thumbnail (live notifications)
  const isLive = !!(stream?.thumbUrl);

  const components = isLive
    ? [
        {
          type: "header",
          parameters: [{ type: "image", image: { link: stream.thumbUrl } }],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: stream?.title || "Live stream" },
            { type: "text", text: stream?.url   || "https://youtube.com" },
          ],
        },
      ]
    : [
        {
          type: "body",
          parameters: [
            { type: "text", text: stream?.title || "Live stream" },
            { type: "text", text: stream?.url   || "https://youtube.com" },
          ],
        },
      ];

  const results = await Promise.allSettled(
    RECIPIENTS.map((number) =>
      graphPost(`${PHONE_NUM_ID}/messages`, {
        messaging_product: "whatsapp",
        to: number,
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANG },
          components,
        },
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      console.log(`[WhatsApp] ✅ Sent to ${RECIPIENTS[i]} — ID: ${r.value.messages?.[0]?.id}`);
    } else {
      console.error(`[WhatsApp] ❌ Failed for ${RECIPIENTS[i]}: ${r.reason?.message}`);
    }
  });

  if (results.every((r) => r.status === "rejected")) {
    throw new Error("All WhatsApp messages failed to send");
  }
}


/**
 * testWhatsApp()
 * node -e "require('./notifier/whatsapp').testWhatsApp()"
 */

async function testWhatsApp() {
  try {
    console.log("[WhatsApp] Sending test message...");

    // hello_world has no variables and no header — send components: []
    const results = await Promise.allSettled(
      RECIPIENTS.map((number) =>
        graphPost(`${PHONE_NUM_ID}/messages`, {
          messaging_product: "whatsapp",
          to: number,
          type: "template",
          template: {
            name: "hello_world",
            language: { code: "en_US" },
            components: [],
          },
        })
      )
    );

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        console.log(`[WhatsApp] ✅ Sent to ${RECIPIENTS[i]} — ID: ${r.value.messages?.[0]?.id}`);
      } else {
        console.error(`[WhatsApp] ❌ Failed for ${RECIPIENTS[i]}: ${r.reason?.message}`);
      }
    });

    console.log("[WhatsApp] Test complete.");
  } catch (error) {
    console.log("[WhatsApp] Test failed:", error.message);
  }
}

module.exports = { sendWhatsApp, testWhatsApp };