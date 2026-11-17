/**
 * migrate-meetings.js
 * ───────────────────
 * Migration: Vikao na Maazimio (Meetings & Resolutions)
 * Ref: BSS-KKKT-2026-006
 *
 * Implements Section 11 of the KKKT Yombo database spec.
 *
 * Scope model
 * ───────────
 * Every meeting is either:
 *   • Church-level  — group_id IS NULL  (Mkutano Mkuu, Baraza la Usharika, etc.)
 *   • Group-scoped  — group_id IS NOT NULL (Kamati, Kwaya, Umoja session, etc.)
 *
 * Tables created
 * ──────────────
 *  A. meeting_types       — catalogue of meeting types (Baraza, Mkutano Mkuu …)
 *  B. meetings            — one row per meeting session
 *  C. meeting_attendees   — which members attended (linked to users.id)
 *  D. meeting_resolutions — individual maamuzi per meeting with
 *                           responsible person, deadline, status
 *  E. meeting_documents   — Minutes PDF / other file attachments
 *
 * Run after BSS-KKKT-2026-005.
 *
 * Usage (from project root):
 *   node backend/migrate-meetings.js
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
    if ([1060, 1061, 1050].includes(err.errno)) {
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
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  KKKT — Meetings & Resolutions Migration             ║');
  console.log('║  Ref: BSS-KKKT-2026-006                             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {

    // ── A. meeting_types catalogue ────────────────────────────────────────────
    //
    // `scope_default`:
    //   'church' = this type is typically a church-level meeting
    //   'group'  = this type is typically group-scoped
    //   'both'   = can be either
    //
    console.log('── A. meeting_types catalogue');

    await run('meeting_types table', `
      CREATE TABLE IF NOT EXISTS meeting_types (
        id              INT           NOT NULL AUTO_INCREMENT,
        name_sw         VARCHAR(150)  NOT NULL  COMMENT 'Swahili name, e.g. Baraza la Usharika',
        name_en         VARCHAR(150)  NOT NULL  COMMENT 'English name',
        scope_default   ENUM('church','group','both')
                          NOT NULL DEFAULT 'both'
                          COMMENT 'Typical scope: church-level, group-scoped, or either',
        description     TEXT          NULL,
        is_active       TINYINT(1)    NOT NULL DEFAULT 1,
        sort_order      INT           NOT NULL DEFAULT 0,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_meeting_type_name_sw (name_sw)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Catalogue of meeting types (Aina za vikao)'
    `);

    await run('seed meeting_types — church-level', `
      INSERT IGNORE INTO meeting_types (name_sw, name_en, scope_default, sort_order) VALUES
        ('Mkutano Mkuu',            'Annual General Meeting',      'church', 10),
        ('Baraza la Usharika',      'Parish Council',              'church', 20),
        ('Mkutano wa Viongozi',     'Leaders Meeting',             'church', 30),
        ('Ibada ya Usharika',       'Congregational Service',      'church', 40)
    `);

    await run('seed meeting_types — group-scoped', `
      INSERT IGNORE INTO meeting_types (name_sw, name_en, scope_default, sort_order) VALUES
        ('Mkutano wa Kamati',       'Committee Meeting',           'group',  50),
        ('Mkutano wa Kwaya',        'Choir Meeting',               'group',  60),
        ('Mkutano wa Umoja',        'Union Meeting',               'group',  70),
        ('Mkutano wa Jumuiya',      'Fellowship Cell Meeting',     'group',  80)
    `);

    await run('seed meeting_types — either scope', `
      INSERT IGNORE INTO meeting_types (name_sw, name_en, scope_default, sort_order) VALUES
        ('Mkutano wa Dharura',      'Emergency Meeting',           'both',   90),
        ('Mkutano wa Bajeti',       'Budget Meeting',              'both',  100),
        ('Mkutano wa Tathmini',     'Review / Evaluation Meeting', 'both',  110),
        ('Mafunzo',                 'Training / Workshop',         'both',  120),
        ('Vingine',                 'Other',                       'both',  130)
    `);

    // ── B. meetings ───────────────────────────────────────────────────────────
    //
    // Scope rules (enforced at application level, documented here):
    //   group_id IS NULL  → church-level meeting  (all congregation)
    //   group_id NOT NULL → group-scoped meeting   (one specific group)
    //
    // `convened_by_id`: FK to users — the member who called/chaired the meeting.
    // `secretary_id`  : FK to users — the member who recorded the minutes.
    // `quorum_met`    : boolean — was quorum achieved? Useful for validity.
    //
    console.log('\n── B. meetings table');

    await run('meetings table', `
      CREATE TABLE IF NOT EXISTS meetings (
        id                INT           NOT NULL AUTO_INCREMENT,

        -- ── Scope ──────────────────────────────────────────────────────────
        group_id          INT           NULL
                            COMMENT 'NULL = church-level; NOT NULL = scoped to this group',

        -- ── Classification ────────────────────────────────────────────────
        meeting_type_id   INT           NOT NULL,
        title             VARCHAR(255)  NOT NULL
                            COMMENT 'e.g. "Mkutano wa Kamati ya Fedha – Machi 2026"',

        -- ── When / Where ──────────────────────────────────────────────────
        meeting_date      DATE          NOT NULL  COMMENT 'Tarehe ya kikao',
        start_time        TIME          NULL      COMMENT 'Saa ya kuanza',
        end_time          TIME          NULL      COMMENT 'Saa ya kumalizika',
        venue             VARCHAR(255)  NULL      COMMENT 'Mahali pa kikao',

        -- ── Participants summary ───────────────────────────────────────────
        convened_by_id    INT           NULL
                            COMMENT 'FK to users — Mwenyekiti / aliyeitisha kikao',
        secretary_id      INT           NULL
                            COMMENT 'FK to users — Katibu aliyeandika kumbukumbu',
        quorum_met        TINYINT(1)    NULL
                            COMMENT '1 = Quorum ilifikiwa, 0 = Haikufikiwa',
        total_attendees   SMALLINT      NULL
                            COMMENT 'Jumla ya waliohudhuria (quick count)',

        -- ── Content ───────────────────────────────────────────────────────
        agenda            TEXT          NULL      COMMENT 'Agenda ya kikao',
        summary           TEXT          NULL      COMMENT 'Muhtasari wa kikao',

        -- ── Status ────────────────────────────────────────────────────────
        status            ENUM('scheduled','held','cancelled','postponed')
                            NOT NULL DEFAULT 'scheduled'
                            COMMENT 'Hali ya kikao',
        cancellation_reason TEXT        NULL
                            COMMENT 'Required if status = cancelled or postponed',

        -- ── Timestamps ────────────────────────────────────────────────────
        created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_meeting_group
          FOREIGN KEY (group_id) REFERENCES \`groups\` (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        CONSTRAINT fk_meeting_type
          FOREIGN KEY (meeting_type_id) REFERENCES meeting_types (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        CONSTRAINT fk_meeting_convened_by
          FOREIGN KEY (convened_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_meeting_secretary
          FOREIGN KEY (secretary_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_meeting_group        (group_id),
        INDEX idx_meeting_type         (meeting_type_id),
        INDEX idx_meeting_date         (meeting_date),
        INDEX idx_meeting_status       (status),
        INDEX idx_meeting_convened_by  (convened_by_id)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Vikao — church-level (group_id IS NULL) or group-scoped (group_id NOT NULL)'
    `);

    // ── C. meeting_attendees ──────────────────────────────────────────────────
    //
    // Links individual members to a meeting.
    // `attendance_type`: present | apology | absent
    //   - present  = alihudhuia
    //   - apology  = alitoa udhuru
    //   - absent   = hakuhudhuia bila udhuru
    //
    // `role_in_meeting`: optional — e.g. Mwenyekiti, Katibu, Mwasilishaji
    //
    console.log('\n── C. meeting_attendees table');

    await run('meeting_attendees table', `
      CREATE TABLE IF NOT EXISTS meeting_attendees (
        id                INT           NOT NULL AUTO_INCREMENT,
        meeting_id        INT           NOT NULL,
        member_id         INT           NOT NULL,
        attendance_type   ENUM('present','apology','absent')
                            NOT NULL DEFAULT 'present'
                            COMMENT 'present=Alihudhuia, apology=Alitoa udhuru, absent=Hakuhudhuia',
        role_in_meeting   VARCHAR(150)  NULL
                            COMMENT 'Mwenyekiti | Katibu | Mwasilishaji | Mgeni n.k.',
        notes             TEXT          NULL,
        created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_ma_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_ma_member
          FOREIGN KEY (member_id) REFERENCES users (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        -- One attendance record per member per meeting
        UNIQUE KEY uq_ma_meeting_member (meeting_id, member_id),

        INDEX idx_ma_meeting     (meeting_id),
        INDEX idx_ma_member      (member_id),
        INDEX idx_ma_attendance  (attendance_type)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Waliohudhuria — attendance records per meeting'
    `);

    // ── D. meeting_resolutions ────────────────────────────────────────────────
    //
    // One row per individual uamuzi (decision/resolution) made at a meeting.
    // Keeping these separate from the meeting row allows:
    //   • Per-resolution status tracking
    //   • Per-resolution responsible person & deadline
    //   • Filtering/reporting on open vs. completed resolutions across
    //     all meetings (church-wide accountability dashboard)
    //
    // `resolution_number`: sequential number within the meeting
    //   e.g. 1, 2, 3 — matches the minutes numbering.
    //
    // `implementation_status`:
    //   pending    = haijatekelezwa
    //   in_progress = inaendelea
    //   completed  = imekamilika
    //   cancelled  = imefutwa
    //   deferred   = imeahirishwa
    //
    console.log('\n── D. meeting_resolutions table');

    await run('meeting_resolutions table', `
      CREATE TABLE IF NOT EXISTS meeting_resolutions (
        id                    INT           NOT NULL AUTO_INCREMENT,
        meeting_id            INT           NOT NULL,
        resolution_number     SMALLINT      NOT NULL DEFAULT 1
                                COMMENT 'Sequential number within the meeting (1, 2, 3 …)',
        description           TEXT          NOT NULL
                                COMMENT 'Uamuzi / Azimio — the resolution text',

        -- ── Accountability ────────────────────────────────────────────────
        responsible_member_id INT           NULL
                                COMMENT 'FK to users — Mtu anayehusika na utekelezaji',
        responsible_note      VARCHAR(255)  NULL
                                COMMENT 'Free-text if responsible party is not a system user',
        deadline              DATE          NULL
                                COMMENT 'Tarehe ya mwisho ya utekelezaji',

        -- ── Progress ──────────────────────────────────────────────────────
        implementation_status ENUM(
                                'pending',
                                'in_progress',
                                'completed',
                                'cancelled',
                                'deferred'
                              ) NOT NULL DEFAULT 'pending'
                                COMMENT 'Hali ya utekelezaji',
        completion_date       DATE          NULL
                                COMMENT 'Tarehe ilipokamilika (set when status = completed)',
        progress_notes        TEXT          NULL
                                COMMENT 'Maelezo ya maendeleo ya utekelezaji',

        -- ── Timestamps ────────────────────────────────────────────────────
        created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_mr_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_mr_responsible
          FOREIGN KEY (responsible_member_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        -- Each resolution number must be unique within a meeting
        UNIQUE KEY uq_mr_meeting_number (meeting_id, resolution_number),

        INDEX idx_mr_meeting      (meeting_id),
        INDEX idx_mr_responsible  (responsible_member_id),
        INDEX idx_mr_status       (implementation_status),
        INDEX idx_mr_deadline     (deadline)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Maamuzi/Maazimio — individual resolutions per meeting with tracking'
    `);

    // ── E. meeting_documents ──────────────────────────────────────────────────
    //
    // Stores paths/URLs to uploaded files attached to a meeting:
    //   Minutes PDF, agenda document, supporting reports, photos etc.
    //
    // `document_type`:
    //   minutes      = Kumbukumbu za Kikao (PDF/Word)
    //   agenda       = Ajenda iliyopigwa chapa
    //   report       = Ripoti iliyowasilishwa
    //   photo        = Picha
    //   other        = Nyingine
    //
    console.log('\n── E. meeting_documents table');

    await run('meeting_documents table', `
      CREATE TABLE IF NOT EXISTS meeting_documents (
        id              INT           NOT NULL AUTO_INCREMENT,
        meeting_id      INT           NOT NULL,
        document_type   ENUM('minutes','agenda','report','photo','other')
                          NOT NULL DEFAULT 'minutes'
                          COMMENT 'Aina ya nyaraka',
        title           VARCHAR(255)  NOT NULL
                          COMMENT 'Display name of the document',
        file_url        VARCHAR(500)  NOT NULL
                          COMMENT 'Path or URL to the uploaded file',
        file_size_kb    INT           NULL
                          COMMENT 'File size in kilobytes',
        mime_type       VARCHAR(100)  NULL
                          COMMENT 'e.g. application/pdf, image/jpeg',
        uploaded_by_id  INT           NULL
                          COMMENT 'FK to users — aliyepakia nyaraka',
        uploaded_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_md_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_md_uploaded_by
          FOREIGN KEY (uploaded_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_md_meeting  (meeting_id),
        INDEX idx_md_type     (document_type)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Nyaraka za vikao — minutes, agenda and supporting documents'
    `);

    // ── F. Indexes for dashboard queries ──────────────────────────────────────
    //
    // The spec dashboard shows "Maazimio ambayo hayajakamilika" (open resolutions).
    // Composite index speeds up the most common query:
    //   WHERE implementation_status IN ('pending','in_progress')
    //   AND   deadline < CURDATE()
    //
    console.log('\n── F. Composite indexes for dashboard');

    await run('idx_mr_status_deadline composite index', `
      ALTER TABLE meeting_resolutions
        ADD INDEX idx_mr_status_deadline (implementation_status, deadline)
    `);

    // ── Verify ────────────────────────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [tables] = await pool.query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'meeting_types','meetings',
          'meeting_attendees','meeting_resolutions','meeting_documents'
        )
      ORDER BY TABLE_NAME
    `);

    const [typesCount] = await pool.query(
      `SELECT COUNT(*) AS total FROM meeting_types`
    );

    const [typeDist] = await pool.query(`
      SELECT scope_default, COUNT(*) AS cnt
      FROM meeting_types
      GROUP BY scope_default
      ORDER BY scope_default
    `);

    console.log(`\n✅  Migration BSS-KKKT-2026-006 complete.\n`);
    console.log(`📋  New tables (${tables.length}/5):`);
    tables.forEach(t =>
      console.log(`   • ${t.TABLE_NAME.padEnd(28)} — ${t.TABLE_COMMENT}`)
    );

    console.log(`\n📋  Seed data:`);
    console.log(`   • meeting_types : ${typesCount[0].total} rows`);
    typeDist.forEach(r =>
      console.log(`     – scope '${r.scope_default.padEnd(8)}' : ${r.cnt} type(s)`)
    );

    console.log(`\n📋  Scope logic:`);
    console.log(`   • meetings.group_id IS NULL     → Church-level meeting`);
    console.log(`   • meetings.group_id IS NOT NULL → Group-scoped meeting`);
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