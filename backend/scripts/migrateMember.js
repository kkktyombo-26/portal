/**
 * migrate-member-profile-02.js
 * ────────────────────────────
 * Migration: Sacrament answers + marital_status enum repair
 * Ref: BSS-KKKT-2026-002
 * Follows: BSS-KKKT-2026-001 (migrate-member-profile.js)
 *
 * Why this exists
 * ───────────────
 * 1. The profile screen asks UBATIZO and KIPAIMARA as Ndio/Hapana. Only the
 *    dates existed, and a date cannot record "yes, date unknown". Two nullable
 *    booleans carry the answer; the dates stay as optional detail.
 * 2. marital_status ENUM is missing 'Anaishi na mtu', so the cohabiting branch
 *    could never be stored even though cohabiting_partner_name exists.
 * 3. baptism_date / confirmation_date / takes_communion / member_since are
 *    written by the profile screen but were never created by 001. The adds
 *    below are skipped as duplicates if an earlier migration made them.
 *
 * No AFTER clauses: a missing anchor column raises errno 1054, which is not in
 * the skip list, and would abort the run. New columns append at the end.
 *
 * Usage (run from project root):
 *   node backend/migrate-member-profile-02.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

// ── Helper: run a query and log result ──────────────────────────────────────
async function run(label, sql) {
  try {
    const [res] = await pool.query(sql);
    const extra = res && res.affectedRows != null ? ` (${res.affectedRows} rows)` : '';
    console.log(`  ✓ ${label}${extra}`);
  } catch (err) {
    // 1060 = Duplicate column, 1061 = Duplicate index — safe to skip
    if ([1060, 1061].includes(err.errno)) {
      console.log(`  ~ ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ ${label}`);
      console.error(`    MySQL error ${err.errno}: ${err.message}`);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  KKKT — Member Profile Migration 02         ║');
  console.log('║  Ref: BSS-KKKT-2026-002                     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {

    // ── 1. Columns 001 never created but the UI writes ───────
    console.log('── 1. Missing profile columns');

    await run('member_since column', `
      ALTER TABLE users ADD COLUMN member_since DATE NULL
    `);

    await run('baptism_date column', `
      ALTER TABLE users ADD COLUMN baptism_date DATE NULL
    `);

    await run('confirmation_date column', `
      ALTER TABLE users ADD COLUMN confirmation_date DATE NULL
    `);

    await run('takes_communion column', `
      ALTER TABLE users ADD COLUMN takes_communion TINYINT(1) NULL
    `);

    // ── 2. Ndio / Hapana answers ─────────────────────────────
    console.log('\n── 2. Sacrament answers (Ndio / Hapana)');

    await run('is_baptized column', `
      ALTER TABLE users ADD COLUMN is_baptized TINYINT(1) NULL
    `);

    await run('is_confirmed column', `
      ALTER TABLE users ADD COLUMN is_confirmed TINYINT(1) NULL
    `);

    // Backfill: anyone with a recorded date was plainly baptised/confirmed.
    // Leaves NULL (= not yet answered) where there is no date, so the screen
    // still prompts for an answer rather than asserting Hapana.
    await run('backfill is_baptized from baptism_date', `
      UPDATE users
         SET is_baptized = 1
       WHERE baptism_date IS NOT NULL
         AND is_baptized IS NULL
    `);

    await run('backfill is_confirmed from confirmation_date', `
      UPDATE users
         SET is_confirmed = 1
       WHERE confirmation_date IS NOT NULL
         AND is_confirmed IS NULL
    `);

    // ── 3. marital_status enum repair ────────────────────────
    console.log('\n── 3. marital_status enum');

    // Adds 'Anaishi na mtu'. Every existing member of the enum is repeated in
    // the same order, so stored values keep their index and nothing is lost.
    // The UI sends 'Talikiwa' for divorced (it used to send 'Talaka', which
    // this enum never accepted).
    await run("marital_status + 'Anaishi na mtu'", `
      ALTER TABLE users
        MODIFY COLUMN marital_status ENUM(
          'Ameoa','Hajaoa','Ameolewa','Hajaolewa',
          'Mjane','Mgane','Talikiwa','Tengana',
          'Anaishi na mtu'
        ) NULL
    `);

    // ── Verify ───────────────────────────────────────────────
    console.log('\n── Verifying...');

    const WANTED = [
      'ahadi_number', 'member_since', 'baptism_date', 'confirmation_date',
      'takes_communion', 'is_baptized', 'is_confirmed', 'marital_status', 'gender',
    ];

    const [cols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN (${WANTED.map(() => '?').join(',')})
      ORDER BY FIELD(COLUMN_NAME, ${WANTED.map(() => '?').join(',')})
    `, [...WANTED, ...WANTED]);

    const found = new Set(cols.map(c => c.COLUMN_NAME));
    const missing = WANTED.filter(c => !found.has(c));

    console.log(`\n📋  Profile columns (${cols.length}/${WANTED.length}):`);
    cols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(20)} ${c.COLUMN_TYPE}`)
    );
    if (missing.length) {
      console.log(`\n⚠️   Still missing: ${missing.join(', ')}`);
    }

    // Rows whose marital_status was blanked by a rejected write. Worth a look:
    // the UI used to send 'Talaka' and 'Anaishi na mtu', neither of which the
    // old enum accepted, so those saves either threw or stored ''.
    const [[blank]] = await pool.query(`
      SELECT COUNT(*) AS n FROM users WHERE marital_status = ''
    `);
    if (blank.n > 0) {
      console.log(`\n⚠️   ${blank.n} row(s) have marital_status = '' — likely a`);
      console.log(`     rejected write from the old enum. These need re-entering.`);
    }

    const [[answered]] = await pool.query(`
      SELECT
        SUM(is_baptized  IS NOT NULL) AS baptism_answered,
        SUM(is_confirmed IS NOT NULL) AS confirmation_answered,
        COUNT(*)                      AS total
      FROM users
    `);
    console.log(`\n📋  Sacrament answers recorded:`);
    console.log(`   • Ubatizo    ${answered.baptism_answered ?? 0}/${answered.total}`);
    console.log(`   • Kipaimara  ${answered.confirmation_answered ?? 0}/${answered.total}`);

    console.log(`\n✅  Migration 002 complete.`);
    console.log(`\n   Remember: add ahadi_number, is_baptized, is_confirmed,`);
    console.log(`   member_since, baptism_date, confirmation_date and`);
    console.log(`   takes_communion to the column whitelist in userApi.update.\n`);

  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();