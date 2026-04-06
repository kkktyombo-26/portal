const pool = require('../config/db');

async function migrate() {
  try {
    console.log('🔄 Running migration: password reset...');

    // 1. Create password_reset_otps table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id         INT          NOT NULL AUTO_INCREMENT,
        user_id    INT          NOT NULL,
        otp        VARCHAR(6)   NOT NULL,
        expires_at DATETIME     NOT NULL,
        used       TINYINT(1)   NOT NULL DEFAULT 0,
        created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ password_reset_otps table ready');

    // 2. Add reset_token column to users
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN reset_token VARCHAR(64) NULL AFTER updated_at;
    `);
    console.log('✅ reset_token column added');

    // 3. Add reset_token_expires column to users
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN reset_token_expires DATETIME NULL AFTER reset_token;
    `);
    console.log('✅ reset_token_expires column added');

    console.log('✅ Migration successful');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Column already exists, skipping.');
    } else if (err.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⚠️  Table already exists, skipping.');
    } else {
      console.error('❌ Migration failed:', err.message);
    }
  } finally {
    await pool.end();
  }
}

migrate();