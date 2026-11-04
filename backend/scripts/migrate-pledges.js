/**
 * migrate-pledges.js
 * ──────────────────
 * Migration: Pledge Campaigns, Member Pledges & Payment Installments
 * Ref: BSS-KKKT-2026-003  (rev 2 — member self-pledge + payment confirmation workflow)
 *
 * Depends on: BSS-KKKT-2026-001, BSS-KKKT-2026-002
 *
 * What changed in rev 2 vs the original migration
 * ─────────────────────────────────────────────────
 *  • member_pledges  gains a `status` column so member-submitted pledges can
 *    sit in 'pending' until a pastor/elder approves them.
 *
 *  • pledge_payments gains two columns:
 *      - `status`       — tracks whether a member-submitted payment has been
 *                         confirmed (or rejected) by an admin.
 *      - `confirmed_by` — FK → users; records which admin confirmed the payment.
 *
 *  • v_pledge_summary is rebuilt so that:
 *      - `total_paid` / `balance_due` / `auto_fulfilled` count only
 *        CONFIRMED payments (not unreviewed member submissions).
 *      - `pending_payment_count` and `pending_payment_total` are added so
 *        admin dashboards can show "X payments awaiting confirmation".
 *      - `pledge_status` (the new member_pledges.status) is surfaced.
 *
 * New tables
 * ──────────
 *  A. pledge_campaigns     — admin-created campaigns (Jengo 2026, Uwakili 2026 …)
 *  B. member_pledges       — extended: campaign_id FK  +  status column
 *  C. pledge_payments      — extended: status  +  confirmed_by columns
 *
 * Usage:
 *   node backend/migrate-pledges.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/db');

async function run(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✓ ${label}`);
  } catch (err) {
    // Idempotent: skip anything that already exists
    //  1050 — table already exists
    //  1060 — duplicate column name
    //  1061 — duplicate key name (index)
    //  1091 — can't drop index (doesn't exist — harmless here)
    //  1826 — duplicate foreign key constraint name
    if ([1050, 1060, 1061, 1091, 1826].includes(err.errno)) {
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
  console.log('║  KKKT — Pledge Campaign Migration  (rev 2)           ║');
  console.log('║  Ref: BSS-KKKT-2026-003                              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {

    // ── A. pledge_campaigns ───────────────────────────────────────────────────
    //
    // An admin creates a campaign, sets its scope (church / group / member),
    // and optionally links it to a group or a specific member.
    // `pledge_type_id` still references the types catalogue (Jengo, Uwakili …).
    // `target_amount` is the campaign-level goal (optional, for reporting).
    //
    console.log('── A. pledge_campaigns table');

    await run('pledge_campaigns table', `
      CREATE TABLE IF NOT EXISTS pledge_campaigns (
        id                INT             NOT NULL AUTO_INCREMENT,
        name              VARCHAR(200)    NOT NULL  COMMENT 'Human-readable name, e.g. Jengo 2026',
        pledge_type_id    INT             NOT NULL  COMMENT 'FK → pledge_types (Jengo, Uwakili …)',
        description       TEXT            NULL,

        scope             ENUM('church','group','member')
                            NOT NULL DEFAULT 'church'
                            COMMENT 'Who this campaign targets',
        group_id          INT             NULL      COMMENT 'Set when scope = group',
        member_id         INT             NULL      COMMENT 'Set when scope = member',

        pledge_year       YEAR            NOT NULL  COMMENT 'Financial / pledge year',
        start_date        DATE            NULL      COMMENT 'Campaign opens',
        end_date          DATE            NULL      COMMENT 'Campaign closes (last day to pledge)',

        target_amount     DECIMAL(15,2)   NOT NULL DEFAULT 0.00
                            COMMENT 'Campaign-level goal in TShs (0 = no goal set)',

        is_active         TINYINT(1)      NOT NULL DEFAULT 1,
        created_by        INT             NOT NULL  COMMENT 'FK → users (admin who created it)',
        created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_pc_type
          FOREIGN KEY (pledge_type_id) REFERENCES pledge_types (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        CONSTRAINT fk_pc_group
          FOREIGN KEY (group_id) REFERENCES \`groups\` (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_pc_member
          FOREIGN KEY (member_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_pc_creator
          FOREIGN KEY (created_by) REFERENCES users (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        INDEX idx_pc_type       (pledge_type_id),
        INDEX idx_pc_scope      (scope),
        INDEX idx_pc_group      (group_id),
        INDEX idx_pc_member     (member_id),
        INDEX idx_pc_year       (pledge_year),
        INDEX idx_pc_active     (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Admin-created pledge campaigns scoped to church | group | member'
    `);

    // ── B. member_pledges — extend existing table ─────────────────────────────
    //
    // The table was created in migration 002 with pledge_type_id + pledge_year.
    // Rev 1 adds campaign_id so each member pledge is linked to a campaign.
    // Rev 2 adds status so member-submitted pledges start as 'pending' and
    //        only become 'active' after a pastor/elder approves them.
    //
    // Status lifecycle:
    //   pending  → active    (admin approves)
    //   pending  → rejected  (admin rejects)
    //   active   → pending   (admin reopens — rare)
    //
    console.log('\n── B. member_pledges — add campaign_id + status columns');

    await run('campaign_id column on member_pledges', `
      ALTER TABLE member_pledges
        ADD COLUMN campaign_id INT NULL
          COMMENT 'FK → pledge_campaigns (NULL for legacy rows)'
          AFTER id
    `);

    await run('fk_mp_campaign foreign key', `
      ALTER TABLE member_pledges
        ADD CONSTRAINT fk_mp_campaign
          FOREIGN KEY (campaign_id) REFERENCES pledge_campaigns (id)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);

    await run('idx_mp_campaign index', `
      ALTER TABLE member_pledges
        ADD INDEX idx_mp_campaign (campaign_id)
    `);

    // NEW in rev 2 ─────────────────────────────────────────────────────────────
    // Default is 'active' so that all existing rows (admin-created) remain valid
    // without a data backfill.  New member self-pledges are inserted as 'pending'.
    await run('status column on member_pledges', `
      ALTER TABLE member_pledges
        ADD COLUMN status ENUM('pending','active','rejected')
          NOT NULL DEFAULT 'active'
          COMMENT 'pending = member submitted, awaiting admin approval; active = approved; rejected = declined'
          AFTER campaign_id
    `);

    await run('idx_mp_status index', `
      ALTER TABLE member_pledges
        ADD INDEX idx_mp_status (status)
    `);

    // ── C. pledge_payments ────────────────────────────────────────────────────
    //
    // Each row is one installment payment against a member_pledge record.
    //
    // Rev 2 additions:
    //   `status`       — 'pending_confirmation' when submitted by the member,
    //                     'confirmed' when verified by an admin,
    //                     'rejected'  when declined by an admin.
    //                     Default 'confirmed' keeps legacy/admin-entered rows valid.
    //   `confirmed_by` — FK → users; NULL until an admin acts on the payment.
    //
    console.log('\n── C. pledge_payments table');

    await run('pledge_payments table', `
      CREATE TABLE IF NOT EXISTS pledge_payments (
        id              INT             NOT NULL AUTO_INCREMENT,
        pledge_id       INT             NOT NULL  COMMENT 'FK → member_pledges',
        amount          DECIMAL(15,2)   NOT NULL  COMMENT 'Amount paid this installment (TShs)',
        payment_date    DATE            NOT NULL  COMMENT 'Tarehe ya kulipa',
        payment_method  ENUM('cash','bank_transfer','mobile_money','cheque')
                          NOT NULL DEFAULT 'cash',
        receipt_number  VARCHAR(100)    NULL      COMMENT 'Namba ya risiti',
        notes           TEXT            NULL,
        recorded_by     INT             NOT NULL  COMMENT 'FK → users (who submitted this payment)',

        -- Rev 2: approval workflow columns
        status          ENUM('pending_confirmation','confirmed','rejected')
                          NOT NULL DEFAULT 'confirmed'
                          COMMENT 'confirmed = verified; pending_confirmation = member-submitted, awaiting review; rejected = declined',
        confirmed_by    INT             NULL
                          COMMENT 'FK → users (admin who confirmed/rejected); NULL until reviewed',

        created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_pp_pledge
          FOREIGN KEY (pledge_id) REFERENCES member_pledges (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_pp_recorder
          FOREIGN KEY (recorded_by) REFERENCES users (id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        CONSTRAINT fk_pp_confirmer
          FOREIGN KEY (confirmed_by) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_pp_pledge      (pledge_id),
        INDEX idx_pp_date        (payment_date),
        INDEX idx_pp_method      (payment_method),
        INDEX idx_pp_recorder    (recorded_by),
        INDEX idx_pp_status      (status),         -- NEW: fast filter for pending queue
        INDEX idx_pp_confirmer   (confirmed_by)    -- NEW: audit trail lookup
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Individual installment payments against a member pledge'
    `);

    // If pledge_payments already existed from an earlier run, add the rev-2 columns.
    // The CREATE TABLE above will have been skipped (table exists), so we ALTER.
    await run('status column on pledge_payments (if table pre-existed)', `
      ALTER TABLE pledge_payments
        ADD COLUMN status ENUM('pending_confirmation','confirmed','rejected')
          NOT NULL DEFAULT 'confirmed'
          COMMENT 'confirmed = verified; pending_confirmation = member-submitted, awaiting review; rejected = declined'
          AFTER recorded_by
    `);

    await run('confirmed_by column on pledge_payments (if table pre-existed)', `
      ALTER TABLE pledge_payments
        ADD COLUMN confirmed_by INT NULL
          COMMENT 'FK → users (admin who confirmed/rejected); NULL until reviewed'
          AFTER status
    `);

    await run('fk_pp_confirmer on pledge_payments (if table pre-existed)', `
      ALTER TABLE pledge_payments
        ADD CONSTRAINT fk_pp_confirmer
          FOREIGN KEY (confirmed_by) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);

    await run('idx_pp_status index (if table pre-existed)', `
      ALTER TABLE pledge_payments
        ADD INDEX idx_pp_status (status)
    `);

    await run('idx_pp_confirmer index (if table pre-existed)', `
      ALTER TABLE pledge_payments
        ADD INDEX idx_pp_confirmer (confirmed_by)
    `);

    // ── D. v_pledge_summary view — rebuilt for rev 2 ──────────────────────────
    //
    // Key changes from the original view:
    //
    //  1. `total_paid`         — now counts ONLY confirmed payments.
    //                            Pending member submissions are excluded so they
    //                            don't inflate balances before admin review.
    //
    //  2. `balance_due`        — derived from `total_paid` (confirmed only), same logic.
    //
    //  3. `auto_fulfilled`     — likewise based on confirmed payments only.
    //
    //  4. `pledge_status`      — surfaces member_pledges.status so the front-end
    //                            and controllers can gate actions without an extra query.
    //
    //  5. `pending_payment_count`  — number of payments still awaiting confirmation.
    //  6. `pending_payment_total`  — sum of those pending amounts (TShs).
    //      These two let the admin dashboard show "3 payments (45,000 TShs) awaiting review"
    //      next to each pledge without a separate join.
    //
    console.log('\n── D. v_pledge_summary view (rev 2)');

    await run('drop old v_pledge_summary if exists', `
      DROP VIEW IF EXISTS v_pledge_summary
    `);

    await run('v_pledge_summary view', `
      CREATE VIEW v_pledge_summary AS
      SELECT
        mp.id                                                     AS pledge_id,
        mp.campaign_id,
        mp.member_id,
        mp.pledge_type_id,
        mp.pledge_year,
        mp.pledge_number,
        mp.annual_amount,
        mp.signed_date,
        mp.is_fulfilled,
        mp.notes,
        mp.status                                                 AS pledge_status,
        mp.created_at,

        u.full_name                                               AS member_name,
        u.phone                                                   AS member_phone,

        pc.name                                                   AS campaign_name,
        pc.scope                                                  AS campaign_scope,
        pc.pledge_year                                            AS campaign_year,
        pc.start_date                                             AS campaign_start,
        pc.end_date                                               AS campaign_end,
        pc.is_active                                              AS campaign_is_active,

        pt.name_sw                                                AS pledge_type_name,

        -- Confirmed payments only — these are the numbers that matter financially
        COALESCE(SUM(CASE WHEN pp.status = 'confirmed' THEN pp.amount ELSE 0 END), 0)
                                                                  AS total_paid,

        mp.annual_amount
          - COALESCE(SUM(CASE WHEN pp.status = 'confirmed' THEN pp.amount ELSE 0 END), 0)
                                                                  AS balance_due,

        COUNT(CASE WHEN pp.status = 'confirmed' THEN pp.id END)  AS payment_count,

        CASE
          WHEN mp.annual_amount > 0
           AND COALESCE(SUM(CASE WHEN pp.status = 'confirmed' THEN pp.amount ELSE 0 END), 0)
               >= mp.annual_amount
          THEN 1 ELSE 0
        END                                                       AS auto_fulfilled,

        -- Pending (unconfirmed) payments — for admin review queue
        COUNT(CASE WHEN pp.status = 'pending_confirmation' THEN pp.id END)
                                                                  AS pending_payment_count,

        COALESCE(SUM(CASE WHEN pp.status = 'pending_confirmation' THEN pp.amount ELSE 0 END), 0)
                                                                  AS pending_payment_total

      FROM member_pledges mp
      JOIN  users            u   ON u.id  = mp.member_id
      LEFT JOIN pledge_campaigns pc  ON pc.id = mp.campaign_id
      LEFT JOIN pledge_types     pt  ON pt.id = mp.pledge_type_id
      LEFT JOIN pledge_payments  pp  ON pp.pledge_id = mp.id
      GROUP BY
        mp.id, mp.campaign_id, mp.member_id, mp.pledge_type_id,
        mp.pledge_year, mp.pledge_number, mp.annual_amount,
        mp.signed_date, mp.is_fulfilled, mp.notes, mp.status, mp.created_at,
        u.full_name, u.phone,
        pc.name, pc.scope, pc.pledge_year, pc.start_date, pc.end_date, pc.is_active,
        pt.name_sw
    `);

    // ── E. Verify ─────────────────────────────────────────────────────────────
    console.log('\n── E. Verifying...');

    const [tables] = await pool.query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('pledge_campaigns','member_pledges','pledge_payments')
      ORDER BY TABLE_NAME
    `);

    const [views] = await pool.query(`
      SELECT TABLE_NAME FROM information_schema.VIEWS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'v_pledge_summary'
    `);

    // Report new columns on member_pledges
    const [mpCols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'member_pledges'
        AND COLUMN_NAME IN ('campaign_id','status')
      ORDER BY ORDINAL_POSITION
    `);

    // Report new columns on pledge_payments
    const [ppCols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'pledge_payments'
        AND COLUMN_NAME IN ('status','confirmed_by')
      ORDER BY ORDINAL_POSITION
    `);

    console.log(`\n✅  Migration BSS-KKKT-2026-003 (rev 2) complete.\n`);

    console.log(`📋  Tables (${tables.length}):`);
    tables.forEach(t => console.log(`   • ${t.TABLE_NAME.padEnd(24)} ${t.TABLE_COMMENT}`));

    console.log(`\n📋  Views (${views.length}):`);
    views.forEach(v => console.log(`   • ${v.TABLE_NAME}`));

    console.log('\n📋  New columns on member_pledges:');
    mpCols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(16)} ${c.COLUMN_TYPE}  default=${c.COLUMN_DEFAULT}`)
    );

    console.log('\n📋  New columns on pledge_payments:');
    ppCols.forEach(c =>
      console.log(`   • ${c.COLUMN_NAME.padEnd(16)} ${c.COLUMN_TYPE}  default=${c.COLUMN_DEFAULT}`)
    );

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