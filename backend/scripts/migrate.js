const pool = require('../config/db'); // adjust path to your db module
const fs   = require('fs');
const path = require('path');

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/migration_member_profile.sql'),
    'utf8'
  );

  // Split on semicolons, drop empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const conn = await pool.getConnection();
  try {
    for (const statement of statements) {
      console.log('▶ Running:', statement.slice(0, 60) + '...');
      await conn.query(statement);
    }
    console.log('✅ Migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

migrate();