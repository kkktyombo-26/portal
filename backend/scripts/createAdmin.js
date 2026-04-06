/**
 * scripts/createAdmin.js
 * ──────────────────────
 * Creates (or updates) the pastor admin account.
 *
 * Usage:
 *   node scripts/createAdmin.js
 */

require('dotenv').config();
const bcrypt   = require('bcryptjs');
const readline = require('readline');
const pool     = require('../config/db');

const ADMIN = {
  full_name: 'Admin1',
  email:     'kkktyombo@gmail.com',
  role:      'pastor',
};

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════╗');
  console.log('║   Church Portal — Admin Setup    ║');
  console.log('╚══════════════════════════════════╝\n');

  // ── Get password ────────────────────────────────────────
  let password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) {
    password = await prompt('Enter a password for the admin account: ');
    if (!password || password.length < 6) {
      console.error('❌  Password must be at least 6 characters.');
      process.exit(1);
    }
    const confirm = await prompt('Confirm password: ');
    if (password !== confirm) {
      console.error('❌  Passwords do not match.');
      process.exit(1);
    }
  }

  try {
    console.log('🔐  Hashing password...');
    const hashed = await bcrypt.hash(password, 12);

    // ── Check if admin already exists ───────────────────────
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [ADMIN.email]
    );

    if (existing.length > 0) {
      // Update — preserve all other columns, only touch these
      await pool.query(
        `UPDATE users
            SET full_name   = ?,
                password    = ?,
                role        = ?,
                is_active   = 1,
                is_verified = 1
          WHERE email = ?`,
        [ADMIN.full_name, hashed, ADMIN.role, ADMIN.email]
      );
      console.log('\n✅  Existing user updated.');
    } else {
      // Insert — columns listed explicitly to avoid order mistakes
      await pool.query(
        `INSERT INTO users
           (full_name, email,       password, role,       is_active, is_verified)
         VALUES
           (?,         ?,           ?,        ?,          1,         1          )`,
        [ADMIN.full_name, ADMIN.email, hashed, ADMIN.role]
      );
      console.log('\n✅  Admin user created.');
    }

    // ── Verify ───────────────────────────────────────────────
    const [rows] = await pool.query(
      `SELECT id, full_name, email, role, is_active, is_verified
         FROM users WHERE email = ?`,
      [ADMIN.email]
    );

    if (!rows || rows.length === 0) {
      console.error('\n⚠️  Row not found after write — check DB_NAME in your .env');
    } else {
      const u = rows[0];
      console.log('');
      console.log(`    id         : ${u.id}`);
      console.log(`    full_name  : ${u.full_name}`);
      console.log(`    email      : ${u.email}`);
      console.log(`    role       : ${u.role}`);
      console.log(`    is_active  : ${u.is_active}`);
      console.log(`    is_verified: ${u.is_verified}`);
      console.log('\n🚀  The admin can now log in.\n');
    }

  } catch (err) {
    console.error('\n❌  Error:', err.message);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.error('    Run your migrations first so the "users" table exists.');
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();