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
const readline = require("readline");

const SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl", // required for captions
];

const TOKEN_PATH  = path.join(__dirname, "..", "token.json");
const SECRET_PATH = path.join(__dirname, "..", "client_secret.json");

/**
 * Returns true if the stored token is expired (or has no expiry field).
 * Google tokens typically last 1 hour; the refresh_token lasts indefinitely
 * unless revoked, so we only flag the access token expiry here.
 */
function isTokenExpired(token) {
  if (!token.expiry_date) return true;
  // Treat tokens expiring within the next 60 seconds as already expired
  return Date.now() >= token.expiry_date - 60_000;
}

async function main() {
  // ── 1. Ensure client_secret.json exists ───────────────────────────────────
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

  // ── 2. Build OAuth2 client ────────────────────────────────────────────────
  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(SECRET_PATH, "utf8"));
  } catch (err) {
    console.error("ERROR: client_secret.json is not valid JSON.", err.message);
    process.exit(1);
  }

  const { client_id, client_secret, redirect_uris } =
    credentials.installed || credentials.web;

  if (!client_id || !client_secret || !redirect_uris?.length) {
    console.error("ERROR: client_secret.json is missing required fields (client_id, client_secret, redirect_uris).");
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // ── 3. Check for an existing token ───────────────────────────────────────
  if (fs.existsSync(TOKEN_PATH)) {
    let token;
    try {
      token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    } catch {
      console.warn("WARN: token.json is corrupt — re-authorising.\n");
      // fall through to the consent flow below
      token = null;
    }

    if (token) {
      if (!isTokenExpired(token)) {
        console.log("✓ token.json is valid and not yet expired.");
        console.log("  To force re-authorisation: delete token.json and run again.\n");
        return;
      }

      // Access token expired but we have a refresh_token — try a silent refresh
      if (token.refresh_token) {
        console.log("↻ Access token expired — attempting silent refresh…");
        oauth2Client.setCredentials(token);
        try {
          const { credentials: refreshed } = await oauth2Client.refreshAccessToken();
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(refreshed, null, 2));
          console.log("✓ Token refreshed and saved. No further action needed.\n");
          return;
        } catch (err) {
          console.warn("WARN: Silent refresh failed — re-authorising.", err.message, "\n");
          // fall through to the consent flow
        }
      }
    }
  }

  // ── 4. Interactive consent flow ───────────────────────────────────────────
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // ensures refresh_token is always returned
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
    input:  process.stdin,
    output: process.stdout,
  });

  rl.question("Paste the authorisation code here: ", async (code) => {
    rl.close();
    try {
      const { tokens } = await oauth2Client.getToken(code.trim());
      oauth2Client.setCredentials(tokens);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log("\n✓ Success! token.json saved.");
      console.log("  YouTube endpoints are now active.");
      console.log("  This token will auto-refresh — you won't need to run this again.\n");
    } catch (err) {
      console.error("\nERROR: Failed to exchange code for token.", err.message);
      console.error("Make sure you copied the full code and try again.\n");
      process.exit(1);
    }
  });
}

main();