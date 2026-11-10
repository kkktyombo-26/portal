/**
 * migrate-phone-otp.js
 * ─────────────────────────
 * Migration: Create phone_login_otps table + registration-token columns
 * Ref: BSS-KKKT-2026-002
 *
 * Unlike Twilio Verify, NextSMS is a plain SMS gateway —
 * it only delivers the message. We manage OTP state ourselves.
 * This table stores a bcrypt hash of the OTP (never plain text).
 *
 * The verified_token / verified_token_exp columns support the phone-based
 * self-registration flow: after OTP verification the server writes a
 * short-lived token that the client includes in POST /api/auth/register,
 * proving phone ownership without re-sending the OTP.
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
    // ── 1. Base table ────────────────────────────────────────────
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

    // ── 2. Registration-token columns ────────────────────────────
    // These support phone-based self-registration.
    // After a successful OTP verify, the server writes a 64-char hex
    // verified_token (never stored plain in the OTP SMS) and a 15-minute
    // expiry. The client sends this token with POST /api/auth/register,
    // which consumes it (sets both columns back to NULL) on use.
    console.log('\n── 2. Registration-token columns');

    await run('verified_token column', `
      ALTER TABLE phone_login_otps
        ADD COLUMN verified_token     VARCHAR(64) NULL
          AFTER otp_hash
    `);

    await run('verified_token_exp column', `
      ALTER TABLE phone_login_otps
        ADD COLUMN verified_token_exp DATETIME    NULL
          AFTER verified_token
    `);

    // ── 3. Index on verified_token ───────────────────────────────
    // The register endpoint looks up rows by verified_token; without
    // an index this is a full-table scan on every registration attempt.
    console.log('\n── 3. Indexes');

    await run('idx_plo_verified_token index', `
      ALTER TABLE phone_login_otps
        ADD INDEX idx_plo_verified_token (verified_token)
    `);

    // ── Verify ───────────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [cols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM   information_schema.COLUMNS
      WHERE  TABLE_SCHEMA = DATABASE()
        AND  TABLE_NAME   = 'phone_login_otps'
      ORDER  BY ORDINAL_POSITION
    `);

    const [idxs] = await pool.query(`
      SELECT DISTINCT INDEX_NAME
      FROM   information_schema.STATISTICS
      WHERE  TABLE_SCHEMA = DATABASE()
        AND  TABLE_NAME   = 'phone_login_otps'
      ORDER  BY INDEX_NAME
    `);

    console.log(`\n✅  Migration complete.\n`);
    console.log(`📋  phone_login_otps columns (${cols.length}):`);
    cols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(22)} ${c.COLUMN_TYPE.padEnd(20)} nullable=${c.IS_NULLABLE}`)
    );
    console.log(`\n📋  Indexes (${idxs.length}):`);
    idxs.forEach(i => console.log(`   • ${i.INDEX_NAME}`));
    console.log('');

  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();