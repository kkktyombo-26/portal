const mysql = require('mysql2/promise');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

async function setup() {
  let conn;
  try {
    console.log('🔧 Connecting...');
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'church_portal',
      ...(isProduction && { ssl: { rejectUnauthorized: false } }),
      multipleStatements: true, // needed to run multiple SQL statements
    });
    console.log('✅ Connected\n');

    console.log('Creating tables...');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`groups\` (
        id          INT          NOT NULL AUTO_INCREMENT,
        name        VARCHAR(100) NOT NULL,
        name_sw     VARCHAR(100) NOT NULL,
        type        ENUM('choir','youth','elders','women','men','children','other') NOT NULL DEFAULT 'other',
        leader_id   INT          DEFAULT NULL,
        description TEXT,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ groups table ready');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT          NOT NULL AUTO_INCREMENT,
        full_name   VARCHAR(150) NOT NULL,
        email       VARCHAR(150) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        role        ENUM('pastor','elder','group_leader','member') NOT NULL DEFAULT 'member',
        group_id    INT          DEFAULT NULL,
        phone       VARCHAR(20)  DEFAULT NULL,
        avatar      VARCHAR(255) DEFAULT NULL,
        is_active   TINYINT(1)   NOT NULL DEFAULT 1,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ users table ready');

    // Add leader_id FK only if it doesn't exist yet
    const [rows] = await conn.execute(`
      SELECT COUNT(*) as cnt
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'groups'
        AND CONSTRAINT_NAME = 'fk_group_leader'
    `);
    if (rows[0].cnt === 0) {
      await conn.execute(`
        ALTER TABLE \`groups\`
        ADD CONSTRAINT fk_group_leader
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✓ fk_group_leader constraint added');
    } else {
      console.log('✓ fk_group_leader already exists, skipping');
    }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id          INT          NOT NULL AUTO_INCREMENT,
        title_en    VARCHAR(255) NOT NULL,
        title_sw    VARCHAR(255) NOT NULL,
        body_en     TEXT         NOT NULL,
        body_sw     TEXT         NOT NULL,
        scope       ENUM('church','group') NOT NULL DEFAULT 'church',
        group_id    INT          DEFAULT NULL,
        author_id   INT          NOT NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (group_id)  REFERENCES \`groups\`(id)  ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)       ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ announcements table ready\n');

    console.log('✅ Schema setup complete! Now run: node seed.js');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

setup();