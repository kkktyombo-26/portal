/**
 * migrate-groups-unified.js
 * ─────────────────────────
 * Migration: Unify ministries + committees into groups
 * Ref: BSS-KKKT-2026-005
 *
 * Steps:
 *  A. Delete all existing groups (cascades group_members)
 *  B. Add group_id FK to ministries table
 *  C. Add group_id FK to committees table
 *  D. Seed groups from ministries catalogue
 *  E. Seed groups from committees catalogue
 *  F. Migrate member_ministries → group_members
 *  G. Migrate member_committees → group_members
 *  H. Drop member_ministries and member_committees
 *  I. Verify
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db');

async function run(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    if ([1060, 1061, 1091, 1826].includes(err.errno)) {
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
  console.log('║  KKKT — Groups Unified Migration                     ║');
  console.log('║  Ref: BSS-KKKT-2026-005                             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {

    // ── A. Delete all existing groups (cascades group_members) ───────────────
    console.log('── A. Clear existing groups');

    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('DELETE FROM group_members');
    await pool.query('DELETE FROM `groups`');
    await pool.query('ALTER TABLE `groups` AUTO_INCREMENT = 1');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('  ✓ All groups and group_members deleted');

    // ── B. Add group_id column to ministries ─────────────────────────────────
    console.log('\n── B. Add group_id to ministries');

    await run('ministries.group_id column', `
      ALTER TABLE ministries
        ADD COLUMN group_id INT NULL
          COMMENT 'FK to groups.id — the group record for this ministry'
          AFTER id
    `);

    await run('fk_ministry_group foreign key', `
      ALTER TABLE ministries
        ADD CONSTRAINT fk_ministry_group
          FOREIGN KEY (group_id) REFERENCES \`groups\` (id)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // ── C. Add group_id column to committees ──────────────────────────────────
    console.log('\n── C. Add group_id to committees');

    await run('committees.group_id column', `
      ALTER TABLE committees
        ADD COLUMN group_id INT NULL
          COMMENT 'FK to groups.id — the group record for this committee'
          AFTER id
    `);

    await run('fk_committee_group foreign key', `
      ALTER TABLE committees
        ADD CONSTRAINT fk_committee_group
          FOREIGN KEY (group_id) REFERENCES \`groups\` (id)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // ── D. Seed groups from ministries ────────────────────────────────────────
    console.log('\n── D. Seed groups from ministries catalogue');

    // First — check what columns the groups table actually has
    const [groupCols] = await pool.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups'
      ORDER BY ORDINAL_POSITION
    `);
    const colNames = groupCols.map(c => c.COLUMN_NAME);
    console.log(`  ℹ  groups columns: ${colNames.join(', ')}`);

    const [ministries] = await pool.query(
      'SELECT id, name_sw, name_en, category, sort_order FROM ministries WHERE is_active = 1 ORDER BY sort_order'
    );

    // Map ministry category → group type
    const categoryToType = {
      'Spiritual': 'huduma',
      'Choir':     'kwaya',
      'Umoja':     'idara',
    };

    for (const m of ministries) {
      const groupType = categoryToType[m.category] ?? 'huduma';

      // Build insert using only columns that exist in groups table
      // groups table has: id, name, type, description, ...
      // name_sw from ministries → name in groups
      // name_en from ministries → description in groups
      const [result] = await pool.query(
        `INSERT INTO \`groups\` (name, name_sw, type, description, is_archived)
         VALUES (?, ?, ?, ?, 0)`,
        [m.name_sw, m.name_sw, groupType, m.name_en]
      );
      const groupId = result.insertId;

      await pool.query(
        'UPDATE ministries SET group_id = ? WHERE id = ?',
        [groupId, m.id]
      );

      console.log(`  ✓ ${m.name_sw} → groups #${groupId} (${groupType})`);
    }

    // ── E. Seed groups from committees ────────────────────────────────────────
    console.log('\n── E. Seed groups from committees catalogue');

    const [committees] = await pool.query(
      'SELECT id, name, mandate, sort_order FROM committees WHERE is_active = 1 ORDER BY sort_order'
    );

    for (const c of committees) {
      const [result] = await pool.query(
        `INSERT INTO \`groups\` (name, name_sw, type, description, is_archived)
         VALUES (?, ?, 'kamati', ?, 0)`,
        [c.name, c.name, c.mandate ?? null]
      );
      const groupId = result.insertId;

      await pool.query(
        'UPDATE committees SET group_id = ? WHERE id = ?',
        [groupId, c.id]
      );

      console.log(`  ✓ ${c.name} → groups #${groupId} (kamati)`);
    }

    // ── F. Migrate member_ministries → group_members ─────────────────────────
    console.log('\n── F. Migrate member_ministries → group_members');

    // Check if member_ministries still exists
    const [[mmExists]] = await pool.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_ministries'
    `);

    if (mmExists.cnt > 0) {
      const [mmRows] = await pool.query(`
        SELECT mm.member_id, mm.status,
               mm.role_in_ministry, mm.joined_date, mm.left_date, mm.notes,
               m.group_id
        FROM   member_ministries mm
        JOIN   ministries m ON m.id = mm.ministry_id
        WHERE  m.group_id IS NOT NULL
      `);

      let mmMigrated = 0;
      for (const row of mmRows) {
        try {
          await pool.query(
            `INSERT IGNORE INTO group_members
               (group_id, member_id, role_in_group, joined_date, left_date, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              row.group_id,
              row.member_id,
              row.role_in_ministry ?? null,
              row.joined_date ?? null,
              row.left_date ?? null,
              row.status === 'active' ? 'active' : 'former',
              row.notes ?? null,
            ]
          );
          mmMigrated++;
        } catch (_) {}
      }
      console.log(`  ✓ ${mmMigrated} of ${mmRows.length} member_ministries rows migrated`);
    } else {
      console.log('  ~ member_ministries table not found, skipped');
    }

    // ── G. Migrate member_committees → group_members ──────────────────────────
    console.log('\n── G. Migrate member_committees → group_members');

    const [[mcExists]] = await pool.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'member_committees'
    `);

    if (mcExists.cnt > 0) {
      const [mcRows] = await pool.query(`
        SELECT mc.member_id, mc.status,
               mc.role, mc.term_start, mc.term_end, mc.notes,
               c.group_id
        FROM   member_committees mc
        JOIN   committees c ON c.id = mc.committee_id
        WHERE  c.group_id IS NOT NULL
      `);

      let mcMigrated = 0;
      for (const row of mcRows) {
        try {
          await pool.query(
            `INSERT IGNORE INTO group_members
               (group_id, member_id, role_in_group, joined_date, left_date, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              row.group_id,
              row.member_id,
              row.role ?? null,
              row.term_start ?? null,
              row.term_end ?? null,
              row.status === 'active' ? 'active' : 'former',
              row.notes ?? null,
            ]
          );
          mcMigrated++;
        } catch (_) {}
      }
      console.log(`  ✓ ${mcMigrated} of ${mcRows.length} member_committees rows migrated`);
    } else {
      console.log('  ~ member_committees table not found, skipped');
    }

    // ── H. Drop old join tables ───────────────────────────────────────────────
    console.log('\n── H. Drop member_ministries and member_committees');

    await run('drop member_ministries', `DROP TABLE IF EXISTS member_ministries`);
    await run('drop member_committees', `DROP TABLE IF EXISTS member_committees`);

    // ── I. Verify ─────────────────────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [[{ groupCount }]] = await pool.query('SELECT COUNT(*) AS groupCount FROM `groups`');
    const [[{ gmCount }]]    = await pool.query('SELECT COUNT(*) AS gmCount FROM group_members');
    const [groupDist]        = await pool.query(
      'SELECT type, COUNT(*) AS cnt FROM `groups` GROUP BY type ORDER BY type'
    );
    const [groupList]        = await pool.query(
      'SELECT id, name, type FROM `groups` ORDER BY type, id'
    );

    console.log(`\n✅  Migration BSS-KKKT-2026-005 complete.\n`);
    console.log(`📋  Groups created: ${groupCount}`);
    console.log(`📋  Group members migrated: ${gmCount}`);
    console.log(`\n📋  By type:`);
    groupDist.forEach(r => console.log(`   • ${r.type.padEnd(12)} ${r.cnt} group(s)`));
    console.log(`\n📋  Full group list:`);
    groupList.forEach(g => console.log(`   #${String(g.id).padEnd(4)} [${g.type.padEnd(8)}] ${g.name}`));
    console.log('');

  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    await pool.end();
    process.exit(0);
  }
}

main();