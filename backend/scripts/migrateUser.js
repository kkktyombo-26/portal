const pool = require('../config/db');

async function migrate() {
  try {
    console.log('🔄 Running migration...');

   

    await pool.query(`
      ALTER TABLE users
        ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;
    `);

    console.log('✅ Migration successful');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Column already exists, skipping.');
    } else {
      console.error('❌ Migration failed:', err.message);
    }
  } finally {
    await pool.end();
  }
}

migrate();