require("dotenv").config();
const { google } = require("googleapis");
const NodeCache = require("node-cache");
const fs = require("fs");
const path = require("path");

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

// ── RESOLVE CHANNEL ID ───────────────────────────────────────────
// Handles three formats people paste into .env:
//   UCxxxxxxxxxxxxxxxxxxxxxxxxx  (correct channel ID)
//   @ChurchHandleName            (YouTube handle — needs resolving)
//   https://youtube.com/@handle  (full URL — strip it)
async function resolveChannelId() {
  const cacheKey = "resolved_channel_id";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let raw = (process.env.YOUTUBE_CHANNEL_ID || "").trim();

  if (!raw) {
    throw new Error("YOUTUBE_CHANNEL_ID is not set in your .env file.");
  }

  // Strip full URL if pasted
  raw = raw.replace(/https?:\/\/(www\.)?youtube\.com\//i, "");

  // Already a UC... channel ID
  if (raw.startsWith("UC")) {
    cache.set(cacheKey, raw);
    return raw;
  }

  // It's a handle (@ChurchName) or custom URL — resolve via API
  const handle = raw.startsWith("@") ? raw : `@${raw}`;
  console.log(`[YouTube] Resolving handle ${handle} to channel ID...`);

  const res = await youtube.channels.list({
    part: ["id"],
    forHandle: handle.replace("@", ""),
  });

  const id = res.data.items?.[0]?.id;
  if (!id) {
    throw new Error(
      `Could not resolve YouTube handle "${handle}" to a channel ID.\n` +
      `Go to YouTube Studio → Settings → Channel → Advanced Settings\n` +
      `and copy the Channel ID (starts with UC) into your .env file.`
    );
  }

  console.log(`[YouTube] Resolved ${handle} → ${id}`);
  cache.set(cacheKey, id, 86400); // cache for 24 hours
  return id;
}

// ── CHANNEL STATS ── 1 unit ──────────────────────────────────────
async function getChannelStats() {
  const cacheKey = "channel_stats";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const channelId = await resolveChannelId();

  const res = await youtube.channels.list({
    part: ["statistics", "snippet", "contentDetails"],
    id: [channelId],
  });

  const channel = res.data.items?.[0];

  if (!channel) {
    throw new Error(
      `Channel not found for ID "${channelId}".\n` +
      `Verify YOUTUBE_CHANNEL_ID in your .env — go to YouTube Studio → ` +
      `Settings → Channel → Advanced Settings to find the correct ID.`
    );
  }

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error(
      `Channel found but uploads playlist ID is missing. ` +
      `This can happen if the channel has no videos yet or the API key ` +
      `doesn't have permission to read contentDetails.`
    );
  }

  const stats = {
    channelTitle: channel.snippet.title,
    channelId: channel.id,
    subscriberCount: parseInt(channel.statistics.subscriberCount || 0),
    viewCount: parseInt(channel.statistics.viewCount || 0),
    videoCount: parseInt(channel.statistics.videoCount || 0),
    hiddenSubscriberCount: channel.statistics.hiddenSubscriberCount,
    uploadsPlaylistId,
  };

  cache.set(cacheKey, stats);
  return stats;
}

// ── LATEST VIDEOS ── ~3 units ────────────────────────────────────
async function getLatestVideos(maxResults = 5) {
  const cacheKey = `latest_videos_${maxResults}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const channelStats = await getChannelStats();
  const uploadsId = channelStats.uploadsPlaylistId;

  const playlistRes = await youtube.playlistItems.list({
    part: ["contentDetails", "snippet"],
    playlistId: uploadsId,
    maxResults,
  });

  const videoIds = playlistRes.data.items.map((item) => item.contentDetails.videoId);
  if (!videoIds.length) return [];

  const videosRes = await youtube.videos.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: videoIds,
  });

  const videos = videosRes.data.items.map((v) => ({
    id: v.id,
    title: v.snippet.title,
    publishedAt: v.snippet.publishedAt,
    thumbnail: v.snippet.thumbnails?.medium?.url,
    duration: v.contentDetails.duration,
    viewCount: parseInt(v.statistics.viewCount || 0),
    likeCount: parseInt(v.statistics.likeCount || 0),
    commentCount: parseInt(v.statistics.commentCount || 0),
    url: `https://www.youtube.com/watch?v=${v.id}`,
  }));

  cache.set(cacheKey, videos);
  return videos;
}

// ── LIVE STREAM STATUS ── ~3 units ───────────────────────────────
async function getLiveStreamStatus() {
  const cacheKey = "live_stream";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const channelStats = await getChannelStats();
  const uploadsId = channelStats.uploadsPlaylistId;

  let liveResult = { isLive: false };

  const playlistRes = await youtube.playlistItems.list({
    part: ["contentDetails"],
    playlistId: uploadsId,
    maxResults: 3,
  });

  const recentIds = playlistRes.data.items.map((i) => i.contentDetails.videoId);

  if (recentIds.length) {
    const videoRes = await youtube.videos.list({
      part: ["snippet", "liveStreamingDetails", "statistics"],
      id: recentIds,
    });

    const liveVideo = videoRes.data.items.find(
      (v) =>
        v.snippet.liveBroadcastContent === "live" ||
        (v.liveStreamingDetails?.actualStartTime &&
          !v.liveStreamingDetails?.actualEndTime)
    );

    if (liveVideo) {
      liveResult = {
        isLive: true,
        videoId: liveVideo.id,
        title: liveVideo.snippet.title,
        viewerCount: parseInt(liveVideo.liveStreamingDetails?.concurrentViewers || 0),
        startedAt: liveVideo.liveStreamingDetails?.actualStartTime,
        url: `https://www.youtube.com/watch?v=${liveVideo.id}`,
        thumbnail: liveVideo.snippet.thumbnails?.medium?.url,
      };
    }
  }

  cache.set(cacheKey, liveResult, liveResult.isLive ? 30 : 120);
  return liveResult;
}

// ── WATCH HOURS (OAuth2) ─────────────────────────────────────────
function loadOAuthClient() {
  const secretPath = path.join(__dirname, "..", "client_secret.json");
  const tokenPath = path.join(__dirname, "..", "token.json");

  if (!fs.existsSync(secretPath)) {
    throw new Error("client_secret.json not found. Download from Google Cloud Console.");
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error("OAuth2 token not found. Run: node scripts/authorise.js");
  }

  const credentials = JSON.parse(fs.readFileSync(secretPath));
  const cred = credentials.installed || credentials.web;

  if (!cred) {
    throw new Error(
      "client_secret.json format not recognised. Expected 'installed' or 'web' key."
    );
  }

  const { client_id, client_secret, redirect_uris } = cred;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = JSON.parse(fs.readFileSync(tokenPath));
  oauth2Client.setCredentials(token);

  oauth2Client.on("tokens", (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(tokenPath));
    fs.writeFileSync(tokenPath, JSON.stringify({ ...existing, ...newTokens }, null, 2));
  });

  return oauth2Client;
}

async function getWatchHours(startDate, endDate) {
  const cacheKey = `watch_hours_${startDate}_${endDate}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const oauth2Client = loadOAuthClient();
  const channelId = await resolveChannelId();

  const analyticsClient = google.youtubeAnalytics({ version: "v2", auth: oauth2Client });

  const response = await analyticsClient.reports.query({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "estimatedMinutesWatched,views",
  });

  const headers = response.data.columnHeaders?.map((h) => h.name) || [];
  const rows = response.data.rows || [];
  const minIdx = headers.indexOf("estimatedMinutesWatched");
  const viewIdx = headers.indexOf("views");

  const totalMinutes = minIdx >= 0 ? rows.reduce((s, r) => s + (r[minIdx] || 0), 0) : 0;
  const totalViews = viewIdx >= 0 ? rows.reduce((s, r) => s + (r[viewIdx] || 0), 0) : 0;

  const result = {
    estimatedMinutesWatched: Math.round(totalMinutes),
    estimatedHoursWatched: Math.round(totalMinutes / 60),
    views: Math.round(totalViews),
    startDate,
    endDate,
  };

  cache.set(cacheKey, result, 3600);
  return result;
}

// ── COMBINED DASHBOARD PAYLOAD ───────────────────────────────────
async function getDashboardData() {
  const [channelStats, latestVideos, liveStatus] = await Promise.all([
    getChannelStats(),
    getLatestVideos(5),
    getLiveStreamStatus(),
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    channel: channelStats,
    yppProgress: {
      subscribers: {
        current: channelStats.subscriberCount,
        target: 1000,
        percent: Math.min(100, Math.round((channelStats.subscriberCount / 1000) * 100)),
        met: channelStats.subscriberCount >= 1000,
      },
    },
    live: liveStatus,
    latestVideos,
  };
}

module.exports = {
  getChannelStats,
  getLatestVideos,
  getLiveStreamStatus,
  getWatchHours,
  getDashboardData,
};