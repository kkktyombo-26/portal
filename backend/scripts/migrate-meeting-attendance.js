/**
 * migrate-meeting-attendance.js
 * ──────────────────────────────
 * Migration: Meeting attendance RSVP workflow
 * Ref: BSS-KKKT-2026-007
 *
 * Changes:
 *
 *  A. meeting_attendees — extend attendance_type ENUM
 *     Old: present | apology | absent
 *     New: rsvp_yes | rsvp_apology | rsvp_no | present | apology | absent
 *
 *     Meaning:
 *       rsvp_yes     — member self-reported via link: "Nitahudhuria"
 *       rsvp_apology — member self-reported via link: "Sitatoa Udhuru"
 *       rsvp_no      — member self-reported via link: "Sitahudhuria"
 *       present      — manager confirmed: actually attended
 *       apology      — manager confirmed: gave apology
 *       absent       — manager confirmed: did not attend
 *
 *  B. meeting_attendees — add rsvp metadata columns
 *       rsvp_at        TIMESTAMP  — when the member submitted their RSVP
 *       confirmed_at   TIMESTAMP  — when manager confirmed actual attendance
 *       confirmed_by   INT        — FK to users (manager who confirmed)
 *
 *  C. meeting_attendance_invites — track who was invited (link sent to)
 *       Used to show "sent to X members, Y responded" on the detail page.
 *
 * Run after BSS-KKKT-2026-006.
 *
 * Usage:
 *   node backend/migrate-meeting-attendance.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../config/db');

async function run(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    if ([1060, 1061, 1050].includes(err.errno)) {
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
  console.log('║  KKKT — Meeting Attendance RSVP Migration            ║');
  console.log('║  Ref: BSS-KKKT-2026-007                             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {

    // ── A. Extend attendance_type ENUM ────────────────────────────────────────
    //
    // Safe sequence (same pattern as groups type migration):
    //   1. Widen to VARCHAR  — accepts any string, no data lost
    //   2. No remapping needed — existing values stay valid in new ENUM
    //   3. MODIFY to final ENUM
    //
    console.log('── A. Extend meeting_attendees.attendance_type ENUM');

    await run('attendance_type — widen to VARCHAR', `
      ALTER TABLE meeting_attendees
        MODIFY COLUMN attendance_type VARCHAR(30) NOT NULL DEFAULT 'present'
    `);

    await run('attendance_type — apply extended ENUM', `
      ALTER TABLE meeting_attendees
        MODIFY COLUMN attendance_type
          ENUM('rsvp_yes','rsvp_apology','rsvp_no','present','apology','absent')
          NOT NULL DEFAULT 'present'
          COMMENT 'rsvp_* = self-reported by member; present/apology/absent = confirmed by manager'
    `);

    // ── B. Add RSVP metadata columns to meeting_attendees ────────────────────
    console.log('\n── B. Add RSVP metadata columns');

    await run('rsvp_at column', `
      ALTER TABLE meeting_attendees
        ADD COLUMN rsvp_at TIMESTAMP NULL
          COMMENT 'When the member submitted their RSVP response'
          AFTER attendance_type
    `);

    await run('confirmed_at column', `
      ALTER TABLE meeting_attendees
        ADD COLUMN confirmed_at TIMESTAMP NULL
          COMMENT 'When a manager confirmed actual attendance'
          AFTER rsvp_at
    `);

    await run('confirmed_by_id column', `
      ALTER TABLE meeting_attendees
        ADD COLUMN confirmed_by_id INT NULL
          COMMENT 'FK to users — manager who confirmed attendance'
          AFTER confirmed_at
    `);

    await run('fk_ma_confirmed_by foreign key', `
      ALTER TABLE meeting_attendees
        ADD CONSTRAINT fk_ma_confirmed_by
          FOREIGN KEY (confirmed_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);

    await run('idx_ma_rsvp_at index', `
      ALTER TABLE meeting_attendees
        ADD INDEX idx_ma_rsvp_at (rsvp_at)
    `);

    // ── C. meeting_attendance_invites ─────────────────────────────────────────
    //
    // Tracks exactly which members were invited (link sent) for a meeting.
    // This powers the "Waliotumwa: X | Waliojaza: Y" summary on the detail page.
    //
    // `channel`: wa = WhatsApp, sms, email (future-proof)
    // `sent_at`: when the invite was dispatched
    // `responded_at`: denormalised copy — set when member submits RSVP,
    //   to avoid joining meeting_attendees for the summary count.
    //
    console.log('\n── C. meeting_attendance_invites table');

    await run('meeting_attendance_invites table', `
      CREATE TABLE IF NOT EXISTS meeting_attendance_invites (
        id             INT           NOT NULL AUTO_INCREMENT,
        meeting_id     INT           NOT NULL,
        member_id      INT           NOT NULL,
        channel        ENUM('wa','sms','email')
                         NOT NULL DEFAULT 'wa'
                         COMMENT 'Channel used to send the invite',
        sent_by_id     INT           NULL
                         COMMENT 'FK to users — who triggered the send',
        sent_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        responded_at   TIMESTAMP     NULL
                         COMMENT 'Set when member submits RSVP — for quick summary counts',
        created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_mai_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_mai_member
          FOREIGN KEY (member_id) REFERENCES users (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_mai_sent_by
          FOREIGN KEY (sent_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        -- One invite record per member per meeting (re-sends update sent_at)
        UNIQUE KEY uq_mai_meeting_member (meeting_id, member_id),

        INDEX idx_mai_meeting   (meeting_id),
        INDEX idx_mai_member    (member_id),
        INDEX idx_mai_sent_at   (sent_at)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Tracks which members were invited to a meeting via link'
    `);

    // ── Verify ────────────────────────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [attCols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'meeting_attendees'
        AND COLUMN_NAME IN ('attendance_type','rsvp_at','confirmed_at','confirmed_by_id')
      ORDER BY ORDINAL_POSITION
    `);

    const [invCols] = await pool.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'meeting_attendance_invites'
      ORDER BY ORDINAL_POSITION
    `);

    console.log(`\n✅  Migration BSS-KKKT-2026-007 complete.\n`);
    console.log(`📋  Updated columns in meeting_attendees (${attCols.length}/4):`);
    attCols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(20)} ${c.COLUMN_TYPE}`)
    );
    console.log(`\n📋  meeting_attendance_invites columns (${invCols.length}):`);
    invCols.forEach(c => console.log(`   • ${c.COLUMN_NAME}`));
    console.log(`\n📋  RSVP flow:`);
    console.log(`   • rsvp_yes / rsvp_apology / rsvp_no  → self-reported by member via link`);
    console.log(`   • present / apology / absent          → confirmed by manager`);
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