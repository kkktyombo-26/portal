require('dotenv').config();
const pool = require('../config/db');

async function cleanup() {
  try {
    const [result] = await pool.query(
      "DELETE FROM users WHERE email LIKE '$2a$%'"
    );
    console.log(`✅ Deleted ${result.affectedRows} corrupted row(s).`);

    const [rows] = await pool.query(
      'SELECT id, full_name, email, role, is_active, is_verified FROM users'
    );
    console.log('\nRemaining users:');
    console.table(rows);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

cleanup();