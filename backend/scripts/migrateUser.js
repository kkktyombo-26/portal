const pool = require('../config/db');

async function migrate() {
  try {
    console.log('🔄 Running migration...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS uploaded_forms (
        id             INT           NOT NULL AUTO_INCREMENT,
        title_en       VARCHAR(255)  NOT NULL,
        title_sw       VARCHAR(255)  NOT NULL,
        description_en TEXT,
        description_sw TEXT,
        pdf_url        VARCHAR(500)  NOT NULL,
        public_id      VARCHAR(255)  NOT NULL,
        scope          ENUM('church','group') NOT NULL DEFAULT 'church',
        group_id       INT           DEFAULT NULL,
        created_by     INT           NOT NULL,
        is_active      TINYINT(1)    NOT NULL DEFAULT 1,
        created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (group_id)  REFERENCES \`groups\`(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE CASCADE,
        INDEX idx_uploaded_forms_scope      (scope),
        INDEX idx_uploaded_forms_active     (is_active),
        INDEX idx_uploaded_forms_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ Migration successful');
  } catch (err) {
    if (err.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⚠️  Table already exists, skipping.');
    } else {
      console.error('❌ Migration failed:', err.message);
    }
  } finally {
    await pool.end();
  }
}

migrate();