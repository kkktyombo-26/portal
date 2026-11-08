// backend/migrate-committees.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db');

async function run(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    if ([1060, 1061].includes(err.errno)) {
      console.log(`  ~ ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ ${label}: ${err.message}`);
      throw err;
    }
  }
}

async function main() {
  console.log('\n── BSS-KKKT-2026-003: Committees\n');

  try {
    await run('committees table', `
      CREATE TABLE IF NOT EXISTS committees (
        id          INT          NOT NULL AUTO_INCREMENT,
        name        VARCHAR(150) NOT NULL,
        mandate     TEXT         NULL,
        is_standing TINYINT(1)   NOT NULL DEFAULT 1,
        is_active   TINYINT(1)   NOT NULL DEFAULT 1,
        sort_order  INT          NOT NULL DEFAULT 0,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_committee_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await run('seed committees', `
      INSERT IGNORE INTO committees (name, sort_order) VALUES
        ('Kamati ya Fedha',                  10),
        ('Kamati ya Muziki',                 20),
        ('Kamati ya Uinjilisti na Umision',  30),
        ('Kamati ya Tehama',                 40),
        ('Kamati ya Milki',                  50)
    `);

    await run('member_committees table', `
      CREATE TABLE IF NOT EXISTS member_committees (
        id           INT          NOT NULL AUTO_INCREMENT,
        member_id    INT          NOT NULL,
        committee_id INT          NOT NULL,
        role         VARCHAR(100) NULL,
        status       ENUM('active','former','pending') NOT NULL DEFAULT 'active',
        term_start   DATE         NULL,
        term_end     DATE         NULL,
        appointed_by INT          NULL,
        notes        TEXT         NULL,
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                       ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_mc_member
          FOREIGN KEY (member_id)    REFERENCES users (id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_mc_committee
          FOREIGN KEY (committee_id) REFERENCES committees (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,
        UNIQUE KEY uq_member_committee (member_id, committee_id),
        INDEX idx_mc_member    (member_id),
        INDEX idx_mc_committee (committee_id),
        INDEX idx_mc_status    (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('\n✅  Migration complete.\n');
  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();