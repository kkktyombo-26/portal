/**
 * scripts/authorise.js
 * ─────────────────────────────────────────────────────────────────
 * Run this ONCE to authorise the church Gmail account for Analytics.
 * It saves a token.json that youtubeService.js reads automatically.
 *
 * Usage:
 *   node scripts/authorise.js
 *
 * Prerequisites:
 *   1. Download client_secret.json from Google Cloud Console
 *      (APIs & Services → Credentials → OAuth 2.0 Client → Download)
 *   2. Place client_secret.json in the project root (same folder as .env)
 * ─────────────────────────────────────────────────────────────────
 */

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const readline = require("readline")

const SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
];

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const SECRET_PATH = path.join(__dirname, "..", "client_secret.json");

async function main() {
  if (!fs.existsSync(SECRET_PATH)) {
    console.error(`
ERROR: client_secret.json not found.

Steps to get it:
  1. Go to https://console.cloud.google.com
  2. Select your church project
  3. APIs & Services → Credentials
  4. Click your OAuth 2.0 Client ID → Download JSON
  5. Rename the file to client_secret.json
  6. Place it in: ${path.dirname(SECRET_PATH)}
  7. Run this script again
`);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(SECRET_PATH));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we already have a valid token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oauth2Client.setCredentials(token);
    console.log("✓ token.json already exists. Re-run only if it expires.");
    console.log("  To force re-authorisation: delete token.json and run again.");
    return;
  }

  // Generate the consent URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // force refresh_token to be included
  });

  console.log("\n──────────────────────────────────────────────────────");
  console.log("CHURCH YOUTUBE — ONE-TIME AUTHORISATION");
  console.log("──────────────────────────────────────────────────────");
  console.log("\n1. Open this URL in your browser (use the church Gmail):");
  console.log(`\n   ${authUrl}\n`);
  console.log("2. Sign in with the church Google account");
  console.log("3. Click Allow");
  console.log("4. Copy the authorisation code shown");
  console.log("──────────────────────────────────────────────────────\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Paste the authorisation code here: ", async (code) => {
    rl.close();
    try {
      const { tokens } = await oauth2Client.getToken(code.trim());
      oauth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log("\n✓ Success! token.json saved.");
      console.log("  Watch hours endpoint is now active.");
      console.log("  This token will auto-refresh — you won't need to run this again.\n");
    } catch (err) {
      console.error("\nFailed to exchange code for token:", err.message);
      console.error("Make sure you copied the full code and try again.\n");
      process.exit(1);
    }
  });
}

main();