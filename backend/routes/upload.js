const express = require("express");
const router = express.Router();
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("stream");
const fs = require("fs");
const path = require("path");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const SECRET_PATH = path.join(__dirname, "..", "client_secret.json");

function getOAuthClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

router.post("/", upload.single("video"), async (req, res) => {
  // Set up SSE so frontend gets live progress
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const { snippet, status, accessToken } = req.body;

    if (!req.file) {
      send({ type: "error", error: "No video file received" });
      return res.end();
    }

    send({ type: "progress", phase: "server", pct: 0, message: "Connecting to YouTube..." });

    const oauth2Client = getOAuthClient(accessToken);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const fileSize = req.file.size;
    let uploaded = 0;

    // Use googleapis resumable upload with progress tracking
    const response = await youtube.videos.insert(
      {
        part: ["snippet", "status"],
        requestBody: {
          snippet: JSON.parse(snippet),
          status: JSON.parse(status),
        },
        media: {
          body: (() => {
            const readable = Readable.from(req.file.buffer);
            readable.on("data", (chunk) => {
              uploaded += chunk.length;
              const pct = Math.round((uploaded / fileSize) * 100);
              send({ type: "progress", phase: "youtube", pct, message: `Uploading to YouTube... ${pct}%` });
            });
            return readable;
          })(),
        },
      },
      {
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.bytesRead / fileSize) * 100);
          send({ type: "progress", phase: "youtube", pct, message: `Uploading to YouTube... ${pct}%` });
        },
      }
    );

    const videoId = response.data.id;
    console.log("[Upload] Done! Video ID:", videoId);
    send({ type: "done", id: videoId });
    res.end();

  } catch (err) {
    console.error("[Upload Error]", err.message);
    send({ type: "error", error: err.message });
    res.end();
  }
});

// ── PATCH video description with chapters ─────────────────────
router.post("/chapters", async (req, res) => {
  try {
    const { videoId, chaptersText, accessToken } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Step 1: Get current snippet
    const getRes = await youtube.videos.list({
      part: ["snippet"],
      id: [videoId],
    });

    const video = getRes.data.items?.[0];
    if (!video) throw new Error(`Video ${videoId} not found`);

    const snippet = video.snippet;

    // Step 2: Strip old chapters block
    let desc = snippet.description || "";
    desc = desc.replace(/\n*─+\n*CHAPTERS[\s\S]*?(?=\n─|\n#|$)/i, "").trimEnd();

    // Step 3: Append new chapters
    const updatedDesc =
      desc +
      `\n\n─────────────────────\nCHAPTERS\n${chaptersText}\n─────────────────────`;

    // Step 4: Update video — must include categoryId
    const updateRes = await youtube.videos.update({
      part: ["snippet"],
      requestBody: {
        id: videoId,
        snippet: {
          title: snippet.title,
          description: updatedDesc,
          categoryId: snippet.categoryId || "29",
          tags: snippet.tags || [],
          defaultLanguage: snippet.defaultLanguage || "en",
        },
      },
    });

    res.json({ success: true, data: updateRes.data });
  } catch (err) {
    console.error("[Chapters Error]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Upload SRT captions ───────────────────────────────────────
router.post("/captions", upload.single("srt"), async (req, res) => {
  try {
    const { videoId, language, accessToken } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    const { Readable } = require("stream");

    const insertRes = await youtube.captions.insert(
      {
        part: ["snippet"],
        requestBody: {
          snippet: {
            videoId,
            language,
            name: `${language} subtitles`,
            isDraft: false,
          },
        },
        media: {
          body: Readable.from(req.file.buffer),
        },
      }
    );

    res.json({ success: true, data: insertRes.data });
  } catch (err) {
    console.error("[Captions Error]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;