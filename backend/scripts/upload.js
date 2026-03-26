/**
 * scripts/upload.js
 * ─────────────────────────────────────────────────────────────────
 * Uploads a recorded service video to YouTube with auto-generated
 * title, description, tags, and thumbnail.
 *
 * Usage:
 *   node scripts/upload.js --file "/path/to/service_2026-04-20.mp4"
 *   node scripts/upload.js --file recording.mp4 --title "Easter Sunday 2026"
 *   node scripts/upload.js --file recording.mp4 --date 2026-04-20 --type easter
 *
 * Options:
 *   --file     Path to the video file (required)
 *   --title    Override the auto-generated title
 *   --date     Service date YYYY-MM-DD (default: today)
 *   --type     Service type: sunday | easter | christmas | special (default: sunday)
 *   --pastor   Preaching pastor name (uses CHURCH_PASTOR from .env if not set)
 *   --series   Sermon series name (optional)
 *
 * Dependencies:
 *   npm install googleapis dotenv
 *   Requires token.json (run scripts/authorise.js first)
 * ─────────────────────────────────────────────────────────────────
 */

require("dotenv").config();
const { google }  = require("googleapis");
const fs          = require("fs");
const path        = require("path");

// ── Parse CLI arguments ───────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

// ── Build metadata from service type + date ───────────────────────
function buildMetadata(args) {
  const church   = process.env.CHURCH_NAME       || "Church";
  const pastor   = args.pastor || process.env.CHURCH_PASTOR || "Pastor";
  const date     = args.date   || new Date().toISOString().split("T")[0];
  const type     = args.type   || "sunday";
  const series   = args.series ? ` | ${args.series}` : "";

  // Format date for display: "April 20, 2026"
  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── Title templates by service type ──────────────────────────────
  const titleTemplates = {
    sunday:    `Sunday Service — ${displayDate} | ${church}`,
    easter:    `Easter Sunday Service ${displayDate} | ${church}`,
    christmas: `Christmas Service ${displayDate} | ${church}`,
    special:   `Special Service — ${displayDate} | ${church}`,
    friday:    `Friday Prayer Night — ${displayDate} | ${church}`,
    midweek:   `Midweek Service — ${displayDate} | ${church}`,
  };

  const title = args.title || titleTemplates[type] || titleTemplates.sunday;

  // ── Description template ─────────────────────────────────────────
  const description = `
Welcome to ${church}!

${type === "easter" ? "🙏 Celebrating the Resurrection of Jesus Christ this Easter Sunday." : ""}
${type === "christmas" ? "🎄 Celebrating the birth of Jesus Christ." : ""}

📖 Join us as ${pastor} ministers the Word of God.${series}

───────────────────────────────────────
📍 Join us in person or follow us online:
   YouTube: ${process.env.YOUTUBE_CHANNEL_URL || "https://www.youtube.com/@" + church.replace(/\s+/g, "")}
   Website: ${process.env.CHURCH_WEBSITE || ""}

💝 Support the Ministry (Online Giving):
   M-Pesa:   ${process.env.CHURCH_MPESA  || ""}
   Airtel:   ${process.env.CHURCH_AIRTEL || ""}
───────────────────────────────────────

👍 Like, Subscribe & Share this video with family and friends.
🔔 Turn on notifications to never miss a service.

#${church.replace(/\s+/g, "")} #Church #Tanzania #LiveService #Gospel
`.trim();

  // ── Tags ─────────────────────────────────────────────────────────
  const tags = [
    church,
    "church service",
    "Tanzania church",
    "gospel",
    "sermon",
    type === "easter"    ? "easter sunday" : "",
    type === "christmas" ? "christmas service" : "",
    "live worship",
    "praise and worship",
    "Christian",
    pastor,
    displayDate,
    "Dar es Salaam church",
  ].filter(Boolean);

  return { title, description, tags, displayDate };
}

// ── OAuth2 client ─────────────────────────────────────────────────
function getOAuthClient() {
  const secretPath = path.join(__dirname, "..", "client_secret.json");
  const tokenPath  = path.join(__dirname, "..", "token.json");

  if (!fs.existsSync(secretPath)) {
    throw new Error("client_secret.json not found. See scripts/authorise.js");
  }
  if (!fs.existsSync(tokenPath)) {
    throw new Error("token.json not found. Run: node scripts/authorise.js");
  }

  const { client_id, client_secret, redirect_uris } =
    JSON.parse(fs.readFileSync(secretPath)).installed;

  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oauth2.setCredentials(JSON.parse(fs.readFileSync(tokenPath)));
  return oauth2;
}

// ── Upload ────────────────────────────────────────────────────────
async function uploadVideo(filePath, metadata) {
  const auth    = getOAuthClient();
  const yt      = google.youtube({ version: "v3", auth });
  const stat    = fs.statSync(filePath);
  const fileSizeMB = (stat.size / 1024 / 1024).toFixed(1);

  console.log(`\n📤 Uploading: ${path.basename(filePath)} (${fileSizeMB} MB)`);
  console.log(`   Title: ${metadata.title}`);

  let lastProgress = 0;

  const response = await yt.videos.insert(
    {
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title:       metadata.title,
          description: metadata.description,
          tags:        metadata.tags,
          categoryId:  "29",            // 29 = Nonprofits & Activism
          defaultLanguage: "en",
        },
        status: {
          privacyStatus:          "public",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    },
    {
      // Track upload progress
      onUploadProgress: (evt) => {
        const progress = Math.round((evt.bytesRead / stat.size) * 100);
        if (progress > lastProgress + 4) {
          process.stdout.write(`\r   Progress: ${progress}%`);
          lastProgress = progress;
        }
      },
    }
  );

  console.log("\n");
  return response.data;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  if (!args.file) {
    console.error("\n❌  Usage: node scripts/upload.js --file <path_to_video.mp4>\n");
    console.error("   Options:");
    console.error("     --file     Path to video file (required)");
    console.error("     --title    Custom title");
    console.error("     --date     Service date YYYY-MM-DD");
    console.error("     --type     sunday | easter | christmas | special | friday | midweek");
    console.error("     --pastor   Preaching pastor name");
    console.error("     --series   Sermon series name\n");
    process.exit(1);
  }

  if (!fs.existsSync(args.file)) {
    console.error(`\n❌  File not found: ${args.file}\n`);
    process.exit(1);
  }

  const metadata = buildMetadata(args);
  const video    = await uploadVideo(args.file, metadata);

  const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;

  console.log("✅  Upload complete!\n");
  console.log(`   Video ID : ${video.id}`);
  console.log(`   URL      : ${videoUrl}`);
  console.log(`   Title    : ${video.snippet?.title}`);
  console.log(`   Status   : ${video.status?.uploadStatus}\n`);
  console.log("Next steps:");
  console.log("  1. Add chapters: node scripts/transcribe.js --id " + video.id);
  console.log("  2. Add custom thumbnail in YouTube Studio");
  console.log("  3. Share URL in church WhatsApp groups\n");

  return videoUrl;
}

main().catch((err) => {
  console.error("\n❌  Upload failed:", err.message);
  if (err.message.includes("token")) {
    console.error("   Run: node scripts/authorise.js\n");
  }
  process.exit(1);
});