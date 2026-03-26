/**
 * scripts/transcribe.js
 * ─────────────────────────────────────────────────────────────────
 * Transcribes a service audio/video file using OpenAI Whisper,
 * detects natural chapter boundaries, and adds them to the
 * YouTube video description as timestamps.
 *
 * Usage:
 *   # From a local file (audio or video):
 *   node scripts/transcribe.js --file recording.mp4
 *
 *   # From an already-uploaded YouTube video ID:
 *   node scripts/transcribe.js --id dQw4w9WgXcQ
 *
 *   # Also generate a .srt subtitle file:
 *   node scripts/transcribe.js --file recording.mp4 --srt
 *
 * How it works:
 *   1. Extracts audio from the video (ffmpeg)
 *   2. Sends to OpenAI Whisper API (fast, accurate, handles Swahili + English)
 *   3. Parses transcript for natural chapter markers
 *      (worship → announcements → sermon → altar call → close)
 *   4. Formats timestamps: "00:00 Introduction\n12:34 Worship..."
 *   5. Patches the YouTube video description with the chapters
 *
 * Prerequisites:
 *   npm install openai googleapis dotenv
 *   Install ffmpeg: https://ffmpeg.org/download.html
 *   (Ubuntu/Debian: sudo apt install ffmpeg)
 *   Requires token.json (run scripts/authorise.js first)
 *
 * Cost: ~$0.006 per minute of audio (Whisper API pricing, March 2026)
 *   A 90-minute service = ~$0.54 per transcription
 *   Consider running locally (see LOCAL_WHISPER.md) for zero cost.
 * ─────────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const { execSync, exec } = require("child_process");
const { google }          = require("googleapis");
const OpenAI              = require("openai");
const fs                  = require("fs");
const path                = require("path");
const os                  = require("os");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Parse CLI args ────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      result[args[i].slice(2)] = args[i + 1] || true;
      i++;
    }
  }
  return result;
}

// ── OAuth2 client ─────────────────────────────────────────────────
function getOAuthClient() {
  const secretPath = path.join(__dirname, "..", "client_secret.json");
  const tokenPath  = path.join(__dirname, "..", "token.json");
  const { client_id, client_secret, redirect_uris } =
    JSON.parse(fs.readFileSync(secretPath)).installed;
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oauth2.setCredentials(JSON.parse(fs.readFileSync(tokenPath)));
  return oauth2;
}

// ── Extract audio from video using ffmpeg ─────────────────────────
async function extractAudio(videoPath) {
  const tmpPath = path.join(os.tmpdir(), `church_audio_${Date.now()}.mp3`);
  console.log("🎵 Extracting audio...");

  return new Promise((resolve, reject) => {
    exec(
      // 16kHz mono MP3 — sufficient for speech, smaller file = faster upload
      `ffmpeg -i "${videoPath}" -vn -ar 16000 -ac 1 -b:a 64k "${tmpPath}" -y`,
      (err) => {
        if (err) reject(new Error(`ffmpeg failed: ${err.message}`));
        else {
          const sizeMB = (fs.statSync(tmpPath).size / 1024 / 1024).toFixed(1);
          console.log(`   Audio extracted: ${sizeMB} MB`);
          resolve(tmpPath);
        }
      }
    );
  });
}

// ── Transcribe with Whisper ───────────────────────────────────────
async function transcribeAudio(audioPath) {
  const sizeMB = (fs.statSync(audioPath).size / 1024 / 1024).toFixed(1);
  console.log(`🤖 Transcribing with Whisper (${sizeMB} MB)...`);
  console.log("   This takes ~1 min per 10 mins of audio.");

  const response = await openai.audio.transcriptions.create({
    file:             fs.createReadStream(audioPath),
    model:            "whisper-1",
    response_format:  "verbose_json",   // includes word-level timestamps
    timestamp_granularities: ["segment"],
    // Whisper handles Swahili + English code-switching well
    // You can hint the language: language: "sw" for Swahili-first
  });

  return response;
}

// ── Detect chapter boundaries from transcript segments ────────────
function detectChapters(segments) {
  const chapters = [];

  // Common church service keywords → chapter labels
  const CHAPTER_PATTERNS = [
    { patterns: [/welcome|karibu|opening/i],       label: "Welcome & Opening Prayer" },
    { patterns: [/worship|praise|sifa|imba/i],      label: "Worship & Praise" },
    { patterns: [/announ/i],                        label: "Announcements" },
    { patterns: [/offering|sadaka|tithes/i],        label: "Tithes & Offering" },
    { patterns: [/sermon|message|neno|preaching/i], label: "Sermon" },
    { patterns: [/altar|prayer line|waliokuja/i],   label: "Altar Call" },
    { patterns: [/closing|dismiss|end|tunaomba/i],  label: "Closing Prayer" },
  ];

  let lastLabel = null;

  segments.forEach((seg) => {
    const text = seg.text.toLowerCase();

    for (const { patterns, label } of CHAPTER_PATTERNS) {
      if (patterns.some((p) => p.test(text)) && label !== lastLabel) {
        chapters.push({
          startSeconds: Math.floor(seg.start),
          label,
        });
        lastLabel = label;
        break;
      }
    }
  });

  // Always ensure chapter 1 starts at 00:00
  if (!chapters.length || chapters[0].startSeconds > 30) {
    chapters.unshift({ startSeconds: 0, label: "Introduction" });
  }

  return chapters;
}

// ── Format seconds → MM:SS or H:MM:SS ────────────────────────────
function formatTime(seconds) {
  const h   = Math.floor(seconds / 3600);
  const m   = Math.floor((seconds % 3600) / 60);
  const s   = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Build chapters text block ─────────────────────────────────────
function buildChaptersText(chapters) {
  return chapters.map((c) => `${formatTime(c.startSeconds)} ${c.label}`).join("\n");
}

// ── Generate SRT subtitle file ────────────────────────────────────
function buildSRT(segments) {
  return segments.map((seg, i) => {
    const startMs = Math.floor(seg.start * 1000);
    const endMs   = Math.floor(seg.end   * 1000);
    const toSRTTime = (ms) => {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000)   / 1000);
      const ms2 = ms % 1000;
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms2).padStart(3,"0")}`;
    };
    return `${i + 1}\n${toSRTTime(startMs)} --> ${toSRTTime(endMs)}\n${seg.text.trim()}`;
  }).join("\n\n");
}

// ── Patch YouTube description with chapters ───────────────────────
async function updateYouTubeDescription(videoId, chaptersText) {
  const auth = getOAuthClient();
  const yt   = google.youtube({ version: "v3", auth });

  // Fetch current video
  const current = await yt.videos.list({
    part: ["snippet"],
    id:   [videoId],
  });

  const snippet = current.data.items?.[0]?.snippet;
  if (!snippet) throw new Error(`Video ${videoId} not found`);

  // Remove old chapters block if present, append new one
  let desc = snippet.description || "";
  desc = desc.replace(/\n*─+\n*CHAPTERS[\s\S]*?(?=\n─|\n#|$)/i, "").trimEnd();

  const updatedDesc =
    desc +
    `\n\n─────────────────────\nCHAPTERS\n${chaptersText}\n─────────────────────`;

  await yt.videos.update({
    part: ["snippet"],
    requestBody: {
      id: videoId,
      snippet: { ...snippet, description: updatedDesc },
    },
  });
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!args.file && !args.id) {
    console.error("\n❌  Usage:");
    console.error("   node scripts/transcribe.js --file recording.mp4");
    console.error("   node scripts/transcribe.js --id <youtube_video_id>");
    console.error("   node scripts/transcribe.js --file recording.mp4 --srt\n");
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("\n❌  OPENAI_API_KEY not set in .env");
    console.error("   Get one at: https://platform.openai.com/api-keys\n");
    process.exit(1);
  }

  let audioPath   = null;
  let tmpAudio    = null;
  let videoId     = args.id || null;

  // Extract audio if video file provided
  if (args.file) {
    if (!fs.existsSync(args.file)) {
      console.error(`\n❌  File not found: ${args.file}\n`);
      process.exit(1);
    }

    // Check if ffmpeg is available
    try { execSync("ffmpeg -version", { stdio: "ignore" }); }
    catch {
      console.error("\n❌  ffmpeg not found. Install it:");
      console.error("   Ubuntu/Debian: sudo apt install ffmpeg");
      console.error("   macOS:         brew install ffmpeg");
      console.error("   Windows:       https://ffmpeg.org/download.html\n");
      process.exit(1);
    }

    tmpAudio  = await extractAudio(args.file);
    audioPath = tmpAudio;
  }

  // Transcribe
  const transcript = await transcribeAudio(audioPath);
  const segments   = transcript.segments || [];
  console.log(`   Transcription done. ${segments.length} segments detected.`);

  // Detect chapters
  const chapters = detectChapters(segments);
  const chaptersText = buildChaptersText(chapters);

  console.log("\n📋 Detected Chapters:");
  console.log(chaptersText);

  // Update YouTube if video ID provided
  if (videoId) {
    console.log(`\n📝 Updating YouTube description for video ${videoId}...`);
    await updateYouTubeDescription(videoId, chaptersText);
    console.log("✅  Chapters added to YouTube description.");
    console.log(`   View: https://www.youtube.com/watch?v=${videoId}`);
  } else {
    console.log("\n💡 To add chapters to YouTube, re-run with --id <video_id>:");
    console.log(`   node scripts/transcribe.js --file ${args.file} --id YOUR_VIDEO_ID`);
  }

  // Save SRT if requested
  if (args.srt) {
    const srtPath = (args.file || videoId) + ".srt";
    fs.writeFileSync(srtPath, buildSRT(segments));
    console.log(`\n💾 SRT file saved: ${srtPath}`);
    console.log("   Upload to YouTube Studio → Subtitles tab.");
  }

  // Save full transcript as text
  const txtPath = `transcript_${Date.now()}.txt`;
  fs.writeFileSync(txtPath, segments.map((s) => s.text).join(" "));
  console.log(`\n💾 Full transcript saved: ${txtPath}`);

  // Cleanup temp audio
  if (tmpAudio && fs.existsSync(tmpAudio)) {
    fs.unlinkSync(tmpAudio);
  }

  console.log("\nDone! ✅\n");
}

main().catch((err) => {
  console.error("\n❌  Error:", err.message);
  process.exit(1);
});