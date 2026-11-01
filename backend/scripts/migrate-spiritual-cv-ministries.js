/**
 * migrate-spiritual-cv-ministries.js
 * ────────────────────────────────────
 * Migration: Spiritual records, CV upload & ministry/pledge modules
 * Ref: BSS-KKKT-2026-002
 *
 * Fills the gaps identified between the PDF spec (sections 1–5, §D)
 * and the first migration (BSS-KKKT-2026-001):
 *
 *  users table additions
 *  ─────────────────────
 *  A. Spiritual sacraments
 *     baptism_date        DATE    — null = not yet baptised
 *     confirmation_date   DATE    — null = not yet confirmed (Kipaimara)
 *     takes_communion     TINYINT(1) — participates in Lord's Supper
 *
 *  B. Documents / CV
 *     cv_url              VARCHAR(500) — path/URL to uploaded CV file
 *
 *  New tables
 *  ──────────
 *  C. ministries          — catalogue of all ministries / service roles
 *  D. member_ministries   — which member belongs to which ministry
 *  E. pledge_types        — catalogue of pledge/ahadi types (Jengo, Uwakili …)
 *  F. member_pledges      — per-member pledge records with annual amount
 *
 * Run once against your existing database after BSS-KKKT-2026-001.
 *
 * Usage:
 *   node backend/migrate-spiritual-cv-ministries.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

// ── Helper ────────────────────────────────────────────────────────────────────
async function run(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    // 1060 = Duplicate column, 1061 = Duplicate index — safe to skip
    if ([1060, 1061].includes(err.errno)) {
      console.log(`  ~ ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ ${label}`);
      console.error(`    MySQL error ${err.errno}: ${err.message}`);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  KKKT — Spiritual, CV & Ministry Migration       ║');
  console.log('║  Ref: BSS-KKKT-2026-002                         ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  try {

    // ── A. Spiritual sacrament columns (users) ────────────────────────────────
    console.log('── A. Spiritual sacraments (users table)');

    await run('baptism_date column', `
      ALTER TABLE users
        ADD COLUMN baptism_date DATE NULL
          COMMENT 'NULL = not yet baptised (Kubatizwa)'
          AFTER previous_church
    `);

    await run('confirmation_date column', `
      ALTER TABLE users
        ADD COLUMN confirmation_date DATE NULL
          COMMENT 'NULL = not yet confirmed (Kipaimara)'
          AFTER baptism_date
    `);

    await run('takes_communion column', `
      ALTER TABLE users
        ADD COLUMN takes_communion TINYINT(1) NOT NULL DEFAULT 0
          COMMENT '1 = participates in Lord''s Supper (Sakramenti ya Meza)'
          AFTER confirmation_date
    `);

    // ── B. CV / document upload (users) ───────────────────────────────────────
    console.log('\n── B. CV upload (users table)');

    await run('cv_url column', `
      ALTER TABLE users
        ADD COLUMN cv_url VARCHAR(500) NULL
          COMMENT 'Path or URL to member''s uploaded CV/resume file'
          AFTER takes_communion
    `);

    // ── C. ministries catalogue ───────────────────────────────────────────────
    //
    // Pre-seeded with the exact ministries listed in PDF §D:
    //   Fellowship, Sunday School, Hospital Visits, Bible Study,
    //   Choir (6 sub-types), Youth Union, Women's Union, Men's Union
    //
    // `category` groups related rows in the UI (Spiritual, Choir, Umoja).
    // `name_sw` / `name_en` support bilingual display.
    // `allows_multiple` flags whether a member can hold >1 role in this
    //   ministry (e.g. you can be in both Choir and Youth Union).
    //
    console.log('\n── C. ministries catalogue');

    await run('ministries table', `
      CREATE TABLE IF NOT EXISTS ministries (
        id               INT           NOT NULL AUTO_INCREMENT,
        name_sw          VARCHAR(150)  NOT NULL  COMMENT 'Swahili name',
        name_en          VARCHAR(150)  NOT NULL  COMMENT 'English name',
        category         VARCHAR(80)   NOT NULL  COMMENT 'Spiritual | Choir | Umoja | Other',
        allows_multiple  TINYINT(1)    NOT NULL DEFAULT 1
                           COMMENT '1 = member may join multiple in same category',
        is_active        TINYINT(1)    NOT NULL DEFAULT 1,
        sort_order       INT           NOT NULL DEFAULT 0,
        created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_ministry_name_sw (name_sw),
        INDEX idx_ministry_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Catalogue of all church ministries and service roles'
    `);

    // Seed initial rows (INSERT IGNORE so re-runs are safe)
    await run('seed ministries — spiritual services', `
      INSERT IGNORE INTO ministries (name_sw, name_en, category, sort_order) VALUES
        ('Fellowship',            'Fellowship',           'Spiritual', 10),
        ('Shule ya Jumapili',     'Sunday School',        'Spiritual', 20),
        ('Kutembelea Wagonjwa',   'Hospital Visits',      'Spiritual', 30),
        ('Masomo ya Biblia',      'Bible Study',          'Spiritual', 40)
    `);

    await run('seed ministries — choirs (Kwaya)', `
      INSERT IGNORE INTO ministries (name_sw, name_en, category, sort_order) VALUES
        ('Kwaya Kuu',             'Main Choir',           'Choir', 50),
        ('Kwaya ya Uinjilisti',   'Evangelism Choir',     'Choir', 60),
        ('Kwaya ya Vijana',       'Youth Choir',          'Choir', 70),
        ('Kwaya ya Wanawake',     'Women Choir',          'Choir', 80),
        ('Kwaya ya Wanaume',      'Men Choir',            'Choir', 90),
        ('Kwaya ya Tarumbeta',    'Trumpet Choir',        'Choir', 100)
    `);

    await run('seed ministries — unions (Umoja)', `
      INSERT IGNORE INTO ministries (name_sw, name_en, category, sort_order) VALUES
        ('Umoja wa Vijana',       'Youth Union',          'Umoja', 110),
        ('Umoja wa Wanawake',     'Women''s Union',       'Umoja', 120),
        ('Umoja wa Wanaume',      'Men''s Union',         'Umoja', 130)
    `);

    // ── D. member_ministries — join table ─────────────────────────────────────
    //
    // Tracks which member has joined (or wants to join) which ministry.
    // `status`: active | pending | former
    // `role_in_ministry`: optional free-text position (e.g. "Secretary",
    //   "Conductor") so the same ministry can be joined more than once
    //   with different roles if needed.
    //
    console.log('\n── D. member_ministries join table');

    await run('member_ministries table', `
      CREATE TABLE IF NOT EXISTS member_ministries (
        id                 INT           NOT NULL AUTO_INCREMENT,
        member_id          INT           NOT NULL,
        ministry_id        INT           NOT NULL,
        status             ENUM('active','pending','former')
                             NOT NULL DEFAULT 'active',
        role_in_ministry   VARCHAR(150)  NULL
                             COMMENT 'Optional: Katibu, Kondakta, Mwanakwaya ...',
        joined_date        DATE          NULL,
        left_date          DATE          NULL,
        notes              TEXT          NULL,
        created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        CONSTRAINT fk_mm_member
          FOREIGN KEY (member_id)  REFERENCES users (id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_mm_ministry
          FOREIGN KEY (ministry_id) REFERENCES ministries (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        -- A member can appear twice in the same ministry only if their
        -- role_in_ministry differs (e.g. leader vs ordinary member).
        UNIQUE KEY uq_member_ministry_role (member_id, ministry_id, role_in_ministry),
        INDEX idx_mm_member   (member_id),
        INDEX idx_mm_ministry (ministry_id),
        INDEX idx_mm_status   (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Which member belongs to which ministry / service role'
    `);

    // ── E. pledge_types catalogue ─────────────────────────────────────────────
    //
    // Matches the four pledge rows shown in PDF §D:
    //   1. Jengo (building fund)
    //   2. Uwakili (stewardship tithe)
    //   3. Mabenchi (benches/furniture)
    //   4. (open slot for future types)
    //
    console.log('\n── E. pledge_types catalogue');

    await run('pledge_types table', `
      CREATE TABLE IF NOT EXISTS pledge_types (
        id          INT           NOT NULL AUTO_INCREMENT,
        name_sw     VARCHAR(150)  NOT NULL  COMMENT 'Swahili name, e.g. Jengo',
        name_en     VARCHAR(150)  NOT NULL  COMMENT 'English name, e.g. Building Fund',
        description TEXT          NULL,
        is_active   TINYINT(1)    NOT NULL DEFAULT 1,
        sort_order  INT           NOT NULL DEFAULT 0,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_pledge_type_name_sw (name_sw)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Catalogue of pledge / ahadi types'
    `);

    await run('seed pledge_types', `
      INSERT IGNORE INTO pledge_types (name_sw, name_en, sort_order) VALUES
        ('Jengo',    'Building Fund',    10),
        ('Uwakili',  'Stewardship',      20),
        ('Mabenchi', 'Benches',          30)
    `);

    // ── F. member_pledges ─────────────────────────────────────────────────────
    //
    // One row per member per pledge type per pledge year.
    //
    // `pledge_number`  : the physical pledge card number (namba ya ahadi)
    //                    from the booklet — used for receipt matching.
    // `annual_amount`  : the TShs amount the member committed for the year.
    // `signed_date`    : date the pledge form was signed (Tarehe ya kujaza).
    // `is_fulfilled`   : set to 1 by the treasurer once full payment received.
    //
    console.log('\n── F. member_pledges table');

    await run('member_pledges table', `
      CREATE TABLE IF NOT EXISTS member_pledges (
        id               INT             NOT NULL AUTO_INCREMENT,
        member_id        INT             NOT NULL,
        pledge_type_id   INT             NOT NULL,
        pledge_year      YEAR            NOT NULL  COMMENT 'Mwaka wa ahadi',
        pledge_number    VARCHAR(50)     NULL      COMMENT 'Namba ya ahadi (card/booklet no.)',
        annual_amount    DECIMAL(15, 2)  NOT NULL DEFAULT 0.00
                           COMMENT 'Kiasi kwa Mwaka (TShs)',
        signed_date      DATE            NULL      COMMENT 'Tarehe ya kujaza / kusaini',
        is_fulfilled     TINYINT(1)      NOT NULL DEFAULT 0
                           COMMENT '1 = ahadi imekamilika',
        notes            TEXT            NULL,
        created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        CONSTRAINT fk_mp_member
          FOREIGN KEY (member_id)      REFERENCES users (id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_mp_pledge_type
          FOREIGN KEY (pledge_type_id) REFERENCES pledge_types (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        -- One pledge record per member per type per year
        UNIQUE KEY uq_member_pledge_year (member_id, pledge_type_id, pledge_year),
        INDEX idx_mp_member      (member_id),
        INDEX idx_mp_type        (pledge_type_id),
        INDEX idx_mp_year        (pledge_year),
        INDEX idx_mp_fulfilled   (is_fulfilled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Per-member annual pledge (ahadi) records'
    `);

    // ── G. Indexes on new users columns ───────────────────────────────────────
    console.log('\n── G. Indexes on new users columns');

    await run('idx_baptism_date index', `
      ALTER TABLE users ADD INDEX idx_baptism_date (baptism_date)
    `);

    await run('idx_takes_communion index', `
      ALTER TABLE users ADD INDEX idx_takes_communion (takes_communion)
    `);

    // ── Verify ────────────────────────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [userCols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN (
          'baptism_date', 'confirmation_date', 'takes_communion', 'cv_url'
        )
      ORDER BY ORDINAL_POSITION
    `);

    const [tables] = await pool.query(`
      SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('ministries','member_ministries','pledge_types','member_pledges')
      ORDER BY TABLE_NAME
    `);

    const [ministriesCount] = await pool.query(
      `SELECT COUNT(*) AS total FROM ministries`
    );
    const [pledgeTypesCount] = await pool.query(
      `SELECT COUNT(*) AS total FROM pledge_types`
    );

    console.log(`\n✅  Migration BSS-KKKT-2026-002 complete.\n`);

    console.log(`📋  New columns in users (${userCols.length}/4):`);
    userCols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(24)} ${c.COLUMN_TYPE.padEnd(18)} — ${c.COLUMN_COMMENT}`)
    );

    console.log(`\n📋  New tables (${tables.length}/4):`);
    tables.forEach(t =>
      console.log(`   • ${t.TABLE_NAME.padEnd(24)} ${t.TABLE_COMMENT}`)
    );

    console.log(`\n📋  Seed data:`);
    console.log(`   • ministries  : ${ministriesCount[0].total} rows`);
    console.log(`   • pledge_types: ${pledgeTypesCount[0].total} rows`);
    console.log('');

  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();