const express = require("express");
const router = express.Router();
const {
  getDashboardData,
  getLiveStreamStatus,
  getLatestVideos,
  getWatchHours,
  getChannelStats,
} = require("../services/youtubeService");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── GET /api/youtube/debug ────────────────────────────────────────
// Run this first to verify your .env values are correct.
// Visit: http://localhost:4000/api/youtube/debug
router.get(
  "/debug",
  asyncHandler(async (req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const channelId = process.env.YOUTUBE_CHANNEL_ID;

    const checks = {
      YOUTUBE_API_KEY: apiKey
        ? `SET (ends in ...${apiKey.slice(-6)})`
        : "MISSING — add to .env",
      YOUTUBE_CHANNEL_ID: channelId
        ? `SET → "${channelId}"`
        : "MISSING — add to .env",
      channel_id_format: channelId?.startsWith("UC")
        ? "OK — starts with UC"
        : channelId?.startsWith("@")
        ? "HANDLE format (@...) — will auto-resolve"
        : "WARNING — unexpected format, should start with UC or @",
    };

    // Try a live channel lookup
    let channelLookup = null;
    try {
      const stats = await getChannelStats();
      channelLookup = {
        status: "OK",
        channelTitle: stats.channelTitle,
        channelId: stats.channelId,
        uploadsPlaylistId: stats.uploadsPlaylistId,
        subscriberCount: stats.subscriberCount,
        videoCount: stats.videoCount,
      };
    } catch (err) {
      channelLookup = { status: "FAILED", error: err.message };
    }

    res.json({ checks, channelLookup });
  })
);

// ── GET /api/youtube/dashboard ───────────────────────────────────
router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const data = await getDashboardData();
    res.json({ success: true, data });
  })
);

// ── GET /api/youtube/live ─────────────────────────────────────────
router.get(
  "/live",
  asyncHandler(async (req, res) => {
    const data = await getLiveStreamStatus();
    res.json({ success: true, data });
  })
);

// ── GET /api/youtube/videos?limit=5 ──────────────────────────────
router.get(
  "/videos",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 5, 10);
    const data = await getLatestVideos(limit);
    res.json({ success: true, data });
  })
);

// ── GET /api/youtube/channel ──────────────────────────────────────
router.get(
  "/channel",
  asyncHandler(async (req, res) => {
    const data = await getChannelStats();
    res.json({ success: true, data });
  })
);

// ── GET /api/youtube/watch-hours ─────────────────────────────────
router.get(
  "/watch-hours",
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const start = req.query.start || oneYearAgo;
    const end = req.query.end || today;

    const data = await getWatchHours(start, end);
    res.json({ success: true, data });
  })
);

// ── Error handler ─────────────────────────────────────────────────
router.use((err, req, res, next) => {
  console.error("[YouTube API Error]", err.message);

  // OAuth2 not set up yet
  if (
    err.message?.includes("OAuth2 token not found") ||
    err.message?.includes("authorise.js")
  ) {
    return res.status(503).json({
      success: false,
      error: "Watch hours unavailable — OAuth2 setup required.",
      setupRequired: true,
      fix: "Run: node scripts/authorise.js",
    });
  }

  // Wrong or missing channel ID
  if (
    err.message?.includes("playlistId") ||
    err.message?.includes("Channel not found") ||
    err.message?.includes("YOUTUBE_CHANNEL_ID")
  ) {
    return res.status(400).json({
      success: false,
      error: "Channel ID problem — check your .env",
      fix: "Visit /api/youtube/debug to diagnose, then update YOUTUBE_CHANNEL_ID in .env",
      detail: err.message,
    });
  }

  // API key invalid or no permission
  if (err.message?.includes("Forbidden") || err.code === 403) {
    return res.status(403).json({
      success: false,
      error: "API key rejected (Forbidden).",
      fix: "Check YOUTUBE_API_KEY in .env. Make sure YouTube Data API v3 is enabled in Google Cloud Console.",
      hint: "Visit: https://console.cloud.google.com → APIs & Services → YouTube Data API v3 → Enable",
    });
  }

  // Quota exceeded
  if (err.message?.includes("quota")) {
    return res.status(429).json({
      success: false,
      error: "YouTube API daily quota exceeded.",
      fix: "Quota resets at midnight Pacific time. Avoid calling /live or /videos more than once per minute.",
    });
  }

  res.status(500).json({
    success: false,
    error: "YouTube API request failed.",
    detail: err.message,
  });
});

module.exports = router;