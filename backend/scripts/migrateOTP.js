/**
 * migrate-phone-otp.js
 * ─────────────────────────
 * Migration: Create phone_login_otps table
 * Ref: BSS-KKKT-2026-002
 *
 * Unlike Twilio Verify, NextSMS is a plain SMS gateway —
 * it only delivers the message. We manage OTP state ourselves.
 * This table stores a bcrypt hash of the OTP (never plain text).
 *
 * Usage (run from project root):
 *   node backend/migrate-phone-otp.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

async function run(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    if ([1060, 1061].includes(err.errno)) {
      console.log(`  ~ ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ ${label}`);
      console.error(`    MySQL error ${err.errno}: ${err.message}`);
      throw err;
    }
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  KKKT — Phone OTP Login Migration           ║');
  console.log('║  Ref: BSS-KKKT-2026-002                     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    console.log('── 1. phone_login_otps table');

    await run('phone_login_otps table', `
      CREATE TABLE IF NOT EXISTS phone_login_otps (
        id          INT           NOT NULL AUTO_INCREMENT,
        phone       VARCHAR(30)   NOT NULL,
        otp_hash    VARCHAR(255)  NOT NULL,
        expires_at  DATETIME      NOT NULL,
        attempts    TINYINT       NOT NULL DEFAULT 0,
        used        TINYINT(1)    NOT NULL DEFAULT 0,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_phone_otp (phone, used, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('\n✅  Migration complete.\n');
  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();