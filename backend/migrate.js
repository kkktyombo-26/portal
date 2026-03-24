const mysql = require('mysql2/promise');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

async function migrate() {
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
    });
    console.log('✅ Connected\n');

    // ─── 1. Events Table ───────────────────────────────────────────
    console.log('Creating events table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id              INT           NOT NULL AUTO_INCREMENT,
        title_en        VARCHAR(255)  NOT NULL,
        title_sw        VARCHAR(255)  NOT NULL,
        description_en  TEXT          DEFAULT NULL,
        description_sw  TEXT          DEFAULT NULL,
        event_date      DATE          NOT NULL,
        start_time      TIME          NOT NULL,
        end_time        TIME          DEFAULT NULL,
        location        VARCHAR(255)  DEFAULT NULL,
        created_by      INT           DEFAULT NULL,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ events table ready');

    // ─── 2. Seed Events ────────────────────────────────────────────
    console.log('Seeding events...');

    // Get pastor id
    const [[pastor]] = await conn.execute(`SELECT id FROM users WHERE role = 'pastor' LIMIT 1`);
    if (!pastor) throw new Error('No pastor found — run seed.js first');
    const pastorId = pastor.id;

    // Helper: add N days to today
    const addDays = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

    // Next Sunday
    const today = new Date();
    const daysUntilSunday = (7 - today.getDay()) % 7 || 7;

    const events = [
      {
        title_en: 'Sunday Worship Service',
        title_sw: 'Ibada ya Jumapili',
        description_en: 'Weekly Sunday worship service. All members and visitors are welcome.',
        description_sw: 'Ibada ya ibada ya kila Jumapili. Wanachama wote na wageni wanakaribishwa.',
        event_date: addDays(daysUntilSunday),
        start_time: '09:00:00',
        end_time: '11:30:00',
        location: 'Main Sanctuary',
      },
      {
        title_en: 'Choir Rehearsal',
        title_sw: 'Mazoezi ya Kwaya',
        description_en: 'Weekly choir practice. All choir members must attend.',
        description_sw: 'Mazoezi ya kwaya ya kila wiki. Wanachama wote wa kwaya lazima wahudhuri.',
        event_date: addDays(5),
        start_time: '18:00:00',
        end_time: '20:00:00',
        location: 'Choir Room',
      },
      {
        title_en: 'Youth Fellowship',
        title_sw: 'Ushirika wa Vijana',
        description_en: 'Monthly youth fellowship meeting with praise, worship and discussions.',
        description_sw: 'Mkutano wa kila mwezi wa ushirika wa vijana na sifa, ibada na majadiliano.',
        event_date: addDays(10),
        start_time: '15:00:00',
        end_time: '17:00:00',
        location: 'Youth Hall',
      },
      {
        title_en: 'Elders Council Meeting',
        title_sw: 'Mkutano wa Baraza la Wazee',
        description_en: 'Monthly elders council meeting to discuss church matters.',
        description_sw: 'Mkutano wa kila mwezi wa baraza la wazee kujadili mambo ya kanisa.',
        event_date: addDays(14),
        start_time: '10:00:00',
        end_time: '12:00:00',
        location: 'Conference Room',
      },
    ];

    for (const e of events) {
      await conn.execute(
        `INSERT INTO events
          (title_en, title_sw, description_en, description_sw, event_date, start_time, end_time, location, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.title_en, e.title_sw, e.description_en, e.description_sw,
         e.event_date, e.start_time, e.end_time, e.location, pastorId]
      );
    }
    console.log('✓ Events seeded\n');

    // ─── 3. Form Templates Table ───────────────────────────────────
    console.log('Creating form_templates table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS form_templates (
        id             INT           NOT NULL AUTO_INCREMENT,
        title_en       VARCHAR(255)  NOT NULL,
        title_sw       VARCHAR(255)  NOT NULL,
        description_en TEXT,
        description_sw TEXT,
        fields         JSON          NOT NULL,
        scope          ENUM('church','group') NOT NULL DEFAULT 'church',
        group_id       INT           DEFAULT NULL,
        created_by     INT           NOT NULL,
        is_active      TINYINT(1)    NOT NULL DEFAULT 1,
        created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (group_id)   REFERENCES \`groups\`(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)      ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ form_templates table ready');

    // Indexes (ignore error if they already exist)
    const indexes = [
      'CREATE INDEX idx_form_templates_scope      ON form_templates (scope)',
      'CREATE INDEX idx_form_templates_active     ON form_templates (is_active)',
      'CREATE INDEX idx_form_templates_created_by ON form_templates (created_by)',
    ];
    for (const sql of indexes) {
      try { await conn.execute(sql); } catch (_) { /* already exists */ }
    }
    console.log('✓ Indexes ready\n');

    // ─── 4. Announcements: add image_url column ────────────────────
    console.log('Updating announcements table...');
    const [cols] = await conn.execute(`
      SELECT COUNT(*) as cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'announcements'
        AND COLUMN_NAME  = 'image_url'
    `);
    if (cols[0].cnt === 0) {
      await conn.execute(`
        ALTER TABLE announcements
        ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER body_sw
      `);
      console.log('✓ image_url column added to announcements');
    } else {
      console.log('✓ image_url already exists, skipping');
    }

    console.log('\n✅ All migrations complete!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
    process.exit(0);
  }
}

migrate();