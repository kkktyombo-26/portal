/**
 * migrate-pledges.js
 * ──────────────────
 * Migration: Pledge Campaigns, Member Pledges & Payment Installments
 * Ref: BSS-KKKT-2026-003
 *
 * Depends on: BSS-KKKT-2026-001, BSS-KKKT-2026-002
 *
 * New tables
 * ──────────
 *  A. pledge_campaigns     — admin-created campaigns (Jengo 2026, Uwakili 2026 …)
 *                            scoped to: church | group | member
 *  B. member_pledges       — already exists from 002 but we ALTER it to reference
 *                            campaign_id instead of the old pledge_type_id approach
 *                            NOTE: if member_pledges is empty, we DROP + RECREATE.
 *                            If it has data, we ADD the new columns and leave the old ones.
 *  C. pledge_payments      — individual installment payments against a member_pledge
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
  console.log('║  KKKT — Pledge Campaign Migration                    ║');
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
    // We add campaign_id so each member pledge is linked to a specific campaign.
    // Old columns are kept so existing data is safe.
    //
    console.log('\n── B. member_pledges — add campaign_id column');

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

    // ── C. pledge_payments ────────────────────────────────────────────────────
    //
    // Each row is one installment payment against a member_pledge record.
    // `payment_method`: cash | bank_transfer | mobile_money | cheque
    // `receipt_number`: the physical receipt number issued to the member
    // `recorded_by`:    who entered this payment into the system
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
        recorded_by     INT             NOT NULL  COMMENT 'FK → users (admin who recorded)',
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

        INDEX idx_pp_pledge   (pledge_id),
        INDEX idx_pp_date     (payment_date),
        INDEX idx_pp_method   (payment_method),
        INDEX idx_pp_recorder (recorded_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Individual installment payments against a member pledge'
    `);

    // ── D. Useful view: pledge summary ────────────────────────────────────────
    //
    // Aggregates total_paid and computes is_fulfilled automatically.
    // Controllers can SELECT from v_pledge_summary for read-heavy endpoints.
    //
    console.log('\n── D. v_pledge_summary view');

    await run('drop old v_pledge_summary if exists', `
      DROP VIEW IF EXISTS v_pledge_summary
    `);

    await run('v_pledge_summary view', `
      CREATE VIEW v_pledge_summary AS
      SELECT
        mp.id                                           AS pledge_id,
        mp.campaign_id,
        mp.member_id,
        mp.pledge_type_id,
        mp.pledge_year,
        mp.pledge_number,
        mp.annual_amount,
        mp.signed_date,
        mp.is_fulfilled,
        mp.notes,
        mp.created_at,

        u.full_name                                     AS member_name,
        u.phone                                         AS member_phone,

        pc.name                                         AS campaign_name,
        pc.scope                                        AS campaign_scope,
        pc.pledge_year                                  AS campaign_year,
        pc.start_date                                   AS campaign_start,
        pc.end_date                                     AS campaign_end,
        pc.is_active                                    AS campaign_is_active,

        pt.name_sw                                      AS pledge_type_name,

        COALESCE(SUM(pp.amount), 0)                    AS total_paid,
        mp.annual_amount - COALESCE(SUM(pp.amount), 0) AS balance_due,
        COUNT(pp.id)                                    AS payment_count,

        CASE
          WHEN mp.annual_amount > 0
               AND COALESCE(SUM(pp.amount), 0) >= mp.annual_amount
          THEN 1 ELSE 0
        END                                             AS auto_fulfilled

      FROM member_pledges mp
      JOIN  users          u   ON u.id  = mp.member_id
      LEFT JOIN pledge_campaigns pc  ON pc.id = mp.campaign_id
      LEFT JOIN pledge_types     pt  ON pt.id = mp.pledge_type_id
      LEFT JOIN pledge_payments  pp  ON pp.pledge_id = mp.id
      GROUP BY
        mp.id, mp.campaign_id, mp.member_id, mp.pledge_type_id,
        mp.pledge_year, mp.pledge_number, mp.annual_amount,
        mp.signed_date, mp.is_fulfilled, mp.notes, mp.created_at,
        u.full_name, u.phone,
        pc.name, pc.scope, pc.pledge_year, pc.start_date, pc.end_date, pc.is_active,
        pt.name_sw
    `);

    // ── Verify ────────────────────────────────────────────────────────────────
    console.log('\n── Verifying...');

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

    console.log(`\n✅  Migration BSS-KKKT-2026-003 complete.\n`);
    console.log(`📋  Tables (${tables.length}):`);
    tables.forEach(t => console.log(`   • ${t.TABLE_NAME.padEnd(24)} ${t.TABLE_COMMENT}`));
    console.log(`\n📋  Views (${views.length}):`);
    views.forEach(v => console.log(`   • ${v.TABLE_NAME}`));
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