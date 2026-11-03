/**
 * migrate-groups-v2.js  (fixed)
 * ─────────────────────
 * Migration: Groups module v2 — types, date intervals, membership join table
 * Ref: BSS-KKKT-2026-004
 *
 * Fix applied: old ENUM values (choir|youth|elders|women|men|children|other)
 * are mapped to new values before the MODIFY COLUMN, so MySQL doesn't
 * reject the ALTER with error 1265 (Data truncated).
 *
 * Final ENUM: jumuiya | ministry | musical | spiritual | administrative | other
 *   - musical   : Kwaya / choirs
 *   - spiritual  : Spiritual groups (e.g. prayer groups, Bible study circles)
 *   - choir → musical, youth/women/men → jumuiya, elders → administrative
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db');

async function run(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    if ([1060, 1061, 1091].includes(err.errno)) {
      console.log(`  ~ ${label} (already exists, skipped)`);
    } else {
      console.error(`  ✗ ${label}`);
      console.error(`    MySQL error ${err.errno}: ${err.message}`);
      throw err;
    }
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  KKKT — Groups v2 Migration (fixed)                  ║');
  console.log('║  Ref: BSS-KKKT-2026-004                              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {

    // ── A. Alter the groups table ─────────────────────────────────────────────
    console.log('── A. Alter `groups` table');

    // ── A0. Widen type to VARCHAR so we can remap values freely ───────────────
    //
    // MODIFY to ENUM fails if ANY existing row holds a value not in the new
    // set (MySQL error 1265). The safe sequence is:
    //
    //   1. Widen the column to VARCHAR  (accepts any string — no data lost)
    //   2. UPDATE rows to map old → new values
    //   3. MODIFY back to the final ENUM  (now every row is already valid)
    //
    await run('type column — widen to VARCHAR for safe remapping', `
      ALTER TABLE \`groups\`
        MODIFY COLUMN type VARCHAR(50) NOT NULL DEFAULT 'other'
    `);

    // ── A1. Map old ENUM values → new ENUM values ─────────────────────────────
    //
    //  Old value   →  New value        Rationale
    //  ──────────────────────────────────────────────────────────────────────
    //  choir       →  musical          Kwaya = musical group
    //  youth       →  jumuiya          Youth fellowship = Jumuiya ya Vijana
    //  elders      →  administrative   Elders council = Baraza la Wazee
    //  women       →  jumuiya          Women's fellowship = Jumuiya ya Wanawake
    //  men         →  jumuiya          Men's fellowship = Jumuiya ya Wanaume
    //  children    →  spiritual        Children's ministry / Sunday school
    //  other       →  other            No change
    //
    // Adjust mappings below if your church uses a different convention.
    //
    console.log('\n── A1. Remap old type values → new ENUM values');

    const mappings = [
      ['choir',    'musical'],
      ['youth',    'jumuiya'],
      ['elders',   'administrative'],
      ['women',    'jumuiya'],
      ['men',      'jumuiya'],
      ['children', 'spiritual'],
    ];

    for (const [oldVal, newVal] of mappings) {
      const [result] = await pool.query(
        'UPDATE `groups` SET type = ? WHERE type = ?',
        [newVal, oldVal]
      );
      if (result.affectedRows > 0) {
        console.log(`  ✓ mapped '${oldVal}' → '${newVal}' (${result.affectedRows} row(s))`);
      } else {
        console.log(`  ~ '${oldVal}' — no rows found, skipped`);
      }
    }

    // Catch anything unexpected — set to 'other' so the MODIFY doesn't fail
    const [unexpected] = await pool.query(`
      UPDATE \`groups\`
      SET type = 'other'
      WHERE type NOT IN ('jumuiya','ministry','musical','spiritual','administrative','other')
    `);
    if (unexpected.affectedRows > 0) {
      console.log(`  ⚠  ${unexpected.affectedRows} row(s) with unrecognised type set to 'other'`);
    }

    // ── A2. Now safe to apply the final ENUM ──────────────────────────────────
    await run('type column — apply final ENUM jumuiya|ministry|musical|spiritual|administrative|other', `
      ALTER TABLE \`groups\`
        MODIFY COLUMN type
          ENUM('jumuiya','ministry','musical','spiritual','administrative','other')
          NOT NULL DEFAULT 'other'
          COMMENT 'jumuiya=Jumuiya ya Kanisa, ministry=Huduma/Kitengo, musical=Kwaya, spiritual=Kiroho/Maombi, administrative=Kamati/Baraza, other'
    `);

    // ── A3. Remaining columns ─────────────────────────────────────────────────
    await run('year column', `
      ALTER TABLE \`groups\`
        ADD COLUMN year YEAR NULL
          COMMENT 'Primary year this group record represents (e.g. 2008 for historical records)'
          AFTER type
    `);

    await run('start_date column', `
      ALTER TABLE \`groups\`
        ADD COLUMN start_date DATE NULL
          COMMENT 'Date this group was formed or this record period begins'
          AFTER year
    `);

    await run('end_date column', `
      ALTER TABLE \`groups\`
        ADD COLUMN end_date DATE NULL
          COMMENT 'NULL = still active; set date = group ended / archived'
          AFTER start_date
    `);

    await run('is_archived column', `
      ALTER TABLE \`groups\`
        ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0
          COMMENT '1 = this is a historical/ended record'
          AFTER end_date
    `);

    await run('idx_groups_type index', `
      ALTER TABLE \`groups\` ADD INDEX idx_groups_type (type)
    `);

    await run('idx_groups_year index', `
      ALTER TABLE \`groups\` ADD INDEX idx_groups_year (year)
    `);

    await run('idx_groups_archived index', `
      ALTER TABLE \`groups\` ADD INDEX idx_groups_archived (is_archived)
    `);

    // ── B. Create group_members join table ────────────────────────────────────
    console.log('\n── B. Create `group_members` join table');

    await run('group_members table', `
      CREATE TABLE IF NOT EXISTS group_members (
        id              INT           NOT NULL AUTO_INCREMENT,
        group_id        INT           NOT NULL,
        member_id       INT           NOT NULL,
        year            YEAR          NULL
                          COMMENT 'Membership year context (e.g. 2008)',
        role_in_group   VARCHAR(150)  NULL
                          COMMENT 'Mwenyekiti | Katibu | Mwanakamati | Mwanachama ...',
        joined_date     DATE          NULL
                          COMMENT 'NULL = unknown (common for old records)',
        left_date       DATE          NULL
                          COMMENT 'NULL = currently active in this group',
        status          ENUM('active','former')
                          NOT NULL DEFAULT 'active',
        notes           TEXT          NULL
                          COMMENT 'Free notes, e.g. "Alikuwa Katibu wa kwanza 2008"',
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_gm_group
          FOREIGN KEY (group_id)  REFERENCES \`groups\` (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_gm_member
          FOREIGN KEY (member_id) REFERENCES users (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        UNIQUE KEY uq_gm_member_group_year_role
          (member_id, group_id, year, role_in_group),

        INDEX idx_gm_group    (group_id),
        INDEX idx_gm_member   (member_id),
        INDEX idx_gm_year     (year),
        INDEX idx_gm_status   (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Group membership records with per-member year, role and date interval'
    `);

    // ── C. Migrate existing users.group_id data ───────────────────────────────
    console.log('\n── C. Migrate existing users.group_id → group_members');

    const [[{ legacy_count }]] = await pool.query(`
      SELECT COUNT(*) AS legacy_count FROM users WHERE group_id IS NOT NULL
    `);

    if (legacy_count > 0) {
      await run(`migrate ${legacy_count} legacy group_id rows`, `
        INSERT IGNORE INTO group_members (group_id, member_id, status)
        SELECT group_id, id, 'active'
        FROM users
        WHERE group_id IS NOT NULL
      `);
      console.log(`  ℹ  ${legacy_count} user(s) migrated from users.group_id`);
    } else {
      console.log('  ~ No legacy group_id rows to migrate');
    }

    // ── D. Back-fill year on existing groups ──────────────────────────────────
    console.log('\n── D. Back-fill year on existing groups');

    await run('back-fill year from created_at for groups missing year', `
      UPDATE \`groups\`
      SET year = YEAR(created_at)
      WHERE year IS NULL
    `);

    // ── Verify ────────────────────────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [groupCols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'groups'
        AND COLUMN_NAME IN ('type','year','start_date','end_date','is_archived')
      ORDER BY ORDINAL_POSITION
    `);

    const [gmCols] = await pool.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_members'
      ORDER BY ORDINAL_POSITION
    `);

    const [[{ gm_rows }]] = await pool.query(
      'SELECT COUNT(*) AS gm_rows FROM group_members'
    );

    const [typeDistrib] = await pool.query(`
      SELECT type, COUNT(*) AS cnt FROM \`groups\` GROUP BY type ORDER BY type
    `);

    console.log(`\n✅  Migration BSS-KKKT-2026-004 complete.\n`);
    console.log(`📋  Updated columns in \`groups\` (${groupCols.length}/5):`);
    groupCols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(16)} ${c.COLUMN_TYPE}`)
    );
    console.log(`\n📋  Type distribution after remapping:`);
    typeDistrib.forEach(r =>
      console.log(`   • ${r.type.padEnd(20)} ${r.cnt} group(s)`)
    );
    console.log(`\n📋  group_members columns (${gmCols.length}):`);
    gmCols.forEach(c => console.log(`   • ${c.COLUMN_NAME}`));
    console.log(`\n📋  group_members rows after migration: ${gm_rows}`);
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