/**
 * routes/whatsapp.js
 *
 * Mount this in your Express app:
 *   const waRoutes = require("./routes/whatsapp");
 *   app.use("/api/whatsapp", waRoutes);
 */

const express = require("express");
const { sendWhatsApp, testWhatsApp } = require("../services/notifier/whatsapp");
const router = express.Router();

/**
 * POST /api/whatsapp/send
 * Body: { type: "live" | "test", stream?: { title, url, videoId, thumbUrl } }
 */
router.post("/send", async (req, res) => {
  const { type, stream } = req.body || {};

  try {
    if (type === "test") {
      await testWhatsApp();
      return res.json({ ok: true, message: "Test message sent successfully" });
    }

    // Build the notification message
    const title = stream?.title || "Live Stream";
    const url   = stream?.url   || "";
    const message =
      `Habari njema! 🔴 *${title}* inaendelea sasa hivi. ` +
      `Jiunge nasi ukitumia kiungo hiki: ${url} — Mungu akubariki!`;

    await sendWhatsApp(message, stream);
    return res.json({
      ok: true,
      message: `Notification sent to all recipients`,
      sent: (process.env.WHATSAPP_RECIPIENTS || "").split(",").filter(Boolean).length,
    });
  } catch (err) {
    console.error("[/api/whatsapp/send]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/whatsapp/test
 * Convenience alias — sends a test message with no stream data.
 */
router.post("/test", async (req, res) => {
  try {
    await testWhatsApp();
    return res.json({ ok: true, message: "Test message sent successfully" });
  } catch (err) {
    console.error("[/api/whatsapp/test]", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;