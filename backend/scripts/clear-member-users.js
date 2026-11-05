/**
 * clear-member-users.js
 * ─────────────────────
 * Deletes all rows in the `users` table where role = 'member'.
 * Also removes their dependent rows in `member_dependants`
 * (handled automatically via ON DELETE CASCADE).
 *
 * Usage (run from project root):
 *   node backend/clear-member-users.js
 *
 * Add --dry-run to preview the count without deleting:
 *   node backend/clear-member-users.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  KKKT — Clear Member Users                  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('  ⚠  DRY RUN — no changes will be made\n');
  }

  try {
    // ── 1. Count rows that will be affected ──────────────────
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE role = 'member'`
    );

    console.log(`  Found ${total} member user(s) in the database.`);

    if (total === 0) {
      console.log('\n  Nothing to delete. Exiting.\n');
      return;
    }

    if (DRY_RUN) {
      console.log(`\n  Would delete ${total} row(s) from users`);
      console.log('  (member_dependants rows removed automatically via CASCADE)\n');
      return;
    }

    // ── 2. Confirm before proceeding ─────────────────────────
    // Uncomment the block below if you want an interactive prompt:
    //
    // const readline = require('readline').createInterface({
    //   input: process.stdin, output: process.stdout
    // });
    // await new Promise((resolve, reject) => {
    //   readline.question(`\n  Delete ${total} member(s)? Type YES to confirm: `, ans => {
    //     readline.close();
    //     if (ans.trim() === 'YES') resolve();
    //     else { console.log('  Aborted.'); reject(new Error('User aborted')); }
    //   });
    // });

    // ── 3. Delete ────────────────────────────────────────────
    const [result] = await pool.query(
      `DELETE FROM users WHERE role = 'member'`
    );

    console.log(`\n✅  Deleted ${result.affectedRows} member user(s).`);
    console.log('    Dependent rows in member_dependants removed via CASCADE.\n');

  } catch (err) {
    console.error('\n❌  Script failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();