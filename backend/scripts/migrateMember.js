/**
 * migrate-member-profile.js
 * ─────────────────────────
 * Migration: Extend member profile fields
 * Ref: BSS-KKKT-2026-001
 *
 * Run once against your existing database.
 * All new columns are nullable so existing rows are unaffected.
 *
 * Usage (run from project root):
 *   node backend/migrate-member-profile.js
 */

const path = require('path');
// If .env is in backend/ (portal/backend/.env):
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

// ── Helper: run a query and log result ──────────────────────────────────────
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
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  KKKT — Member Profile Migration            ║');
  console.log('║  Ref: BSS-KKKT-2026-001                     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {

    // ── 1. Personal details ──────────────────────────────────
    console.log('── 1. Personal details');

    await run('gender column', `
      ALTER TABLE users
        ADD COLUMN gender ENUM('Male','Female') NULL AFTER phone
    `);

    await run('email',`ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL;`);

    await run('date_of_birth column', `
      ALTER TABLE users
        ADD COLUMN date_of_birth DATE NULL AFTER gender
    `);

    await run('place_of_birth column', `
      ALTER TABLE users
        ADD COLUMN place_of_birth VARCHAR(255) NULL AFTER date_of_birth
    `);

    await run('member_status column', `
      ALTER TABLE users
        ADD COLUMN member_status ENUM('hai','amehamia','amefariki')
          NOT NULL DEFAULT 'hai' AFTER place_of_birth
    `);

    // ── 2. Marital information ───────────────────────────────
    console.log('\n── 2. Marital information');

    await run('marital_status column', `
      ALTER TABLE users
        ADD COLUMN marital_status ENUM(
          'Ameoa','Hajaoa','Ameolewa','Hajaolewa',
          'Mjane','Mgane','Talikiwa','Tengana'
        ) NULL AFTER member_status
    `);

    await run('marriage_type column', `
      ALTER TABLE users
        ADD COLUMN marriage_type ENUM('Kikristo','Siya Kikristo')
          NULL AFTER marital_status
    `);

    await run('marriage_date column', `
      ALTER TABLE users
        ADD COLUMN marriage_date DATE NULL AFTER marriage_type
    `);

    await run('marriage_place column', `
      ALTER TABLE users
        ADD COLUMN marriage_place VARCHAR(255) NULL AFTER marriage_date
    `);

    await run('spouse_name column', `
      ALTER TABLE users
        ADD COLUMN spouse_name VARCHAR(255) NULL AFTER marriage_place
    `);

    await run('spouse_phone column', `
      ALTER TABLE users
        ADD COLUMN spouse_phone VARCHAR(30) NULL AFTER spouse_name
    `);

    await run('cohabiting_partner_name column', `
      ALTER TABLE users
        ADD COLUMN cohabiting_partner_name VARCHAR(255) NULL AFTER spouse_phone
    `);

    // ── 3. Professional / education ──────────────────────────
    console.log('\n── 3. Professional / education');

    await run('occupation column', `
      ALTER TABLE users
        ADD COLUMN occupation VARCHAR(255) NULL AFTER cohabiting_partner_name
    `);

    await run('workplace column', `
      ALTER TABLE users
        ADD COLUMN workplace VARCHAR(255) NULL AFTER occupation
    `);

    await run('education column', `
      ALTER TABLE users
        ADD COLUMN education VARCHAR(255) NULL AFTER workplace
    `);

    await run('profession column', `
      ALTER TABLE users
        ADD COLUMN profession VARCHAR(255) NULL AFTER education
    `);

    await run('willing_to_volunteer column', `
      ALTER TABLE users
        ADD COLUMN willing_to_volunteer TINYINT(1) NULL AFTER profession
    `);

    // ── 4. Residence & local contacts ────────────────────────
    console.log('\n── 4. Residence & local contacts');

    await run('jumuiya column', `
      ALTER TABLE users
        ADD COLUMN jumuiya VARCHAR(255) NULL AFTER willing_to_volunteer
    `);

    await run('block_no column', `
      ALTER TABLE users
        ADD COLUMN block_no VARCHAR(50) NULL AFTER jumuiya
    `);

    await run('area_name column', `
      ALTER TABLE users
        ADD COLUMN area_name VARCHAR(255) NULL AFTER block_no
    `);

    await run('slp column', `
      ALTER TABLE users
        ADD COLUMN slp VARCHAR(100) NULL AFTER area_name
    `);

    await run('neighbour_member_name column', `
      ALTER TABLE users
        ADD COLUMN neighbour_member_name VARCHAR(255) NULL AFTER slp
    `);

    await run('neighbour_member_phone column', `
      ALTER TABLE users
        ADD COLUMN neighbour_member_phone VARCHAR(30) NULL AFTER neighbour_member_name
    `);

    await run('elder_name column', `
      ALTER TABLE users
        ADD COLUMN elder_name VARCHAR(255) NULL AFTER neighbour_member_phone
    `);

    await run('elder_phone column', `
      ALTER TABLE users
        ADD COLUMN elder_phone VARCHAR(30) NULL AFTER elder_name
    `);

    await run('previous_church column', `
      ALTER TABLE users
        ADD COLUMN previous_church VARCHAR(255) NULL AFTER elder_phone
    `);

    // ── 5. Dependants table ──────────────────────────────────
    console.log('\n── 5. member_dependants table');

    await run('member_dependants table', `
      CREATE TABLE IF NOT EXISTS member_dependants (
        id            INT           NOT NULL AUTO_INCREMENT,
        member_id     INT           NOT NULL,
        full_name     VARCHAR(255)  NOT NULL,
        date_of_birth DATE          NULL,
        relationship  VARCHAR(100)  NULL,
        created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_dep_member FOREIGN KEY (member_id)
          REFERENCES users (id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        INDEX idx_dep_member (member_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── 6. Indexes ───────────────────────────────────────────
    console.log('\n── 6. Indexes');

    await run('idx_member_status index', `
      ALTER TABLE users ADD INDEX idx_member_status (member_status)
    `);

    await run('idx_gender index', `
      ALTER TABLE users ADD INDEX idx_gender (gender)
    `);

    await run('idx_date_of_birth index', `
      ALTER TABLE users ADD INDEX idx_date_of_birth (date_of_birth)
    `);

    // ── Verify ───────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [userCols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN (
          'gender','date_of_birth','place_of_birth','member_status',
          'marital_status','marriage_type','marriage_date','marriage_place',
          'spouse_name','spouse_phone','cohabiting_partner_name',
          'occupation','workplace','education','profession','willing_to_volunteer',
          'jumuiya','block_no','area_name','slp',
          'neighbour_member_name','neighbour_member_phone',
          'elder_name','elder_phone','previous_church'
        )
      ORDER BY ORDINAL_POSITION
    `);

    const [depCols] = await pool.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'member_dependants'
      ORDER BY ORDINAL_POSITION
    `);

    console.log(`\n✅  Migration complete.\n`);
    console.log(`📋  New columns in users (${userCols.length}/25):`);
    userCols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(28)} ${c.COLUMN_TYPE}`)
    );

    console.log(`\n📋  member_dependants columns (${depCols.length}):`);
    depCols.forEach(c => console.log(`   • ${c.COLUMN_NAME}`));
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