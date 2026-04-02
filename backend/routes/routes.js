

// routes/upload.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { google } = require("googleapis");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("video"), async (req, res) => {
  try {
    const { snippet, status, accessToken } = req.body;
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: JSON.parse(snippet),
        status: JSON.parse(status),
      },
      media: {
        body: require("stream").Readable.from(req.file.buffer),
      },
    });

    res.json({ success: true, id: response.data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;