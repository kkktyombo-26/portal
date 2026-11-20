/**
 * migrate-projects.js
 * ────────────────────
 * Migration: Miradi ya Usharika (Church Projects Module)
 * Ref: BSS-KKKT-2026-008
 *
 * Implements Sections 9, 10, 13 of the KKKT Yombo database spec.
 *
 * Tables created
 * ──────────────
 *  A. projects              — core project record (§13)
 *  B. project_contracts     — contracts per project (§10)
 *  C. contract_variations   — contract variations / change orders
 *  D. project_payments      — payment records per contract (§7 cross-ref)
 *  E. project_documents     — nyaraka (PDF/Word uploads via R2)
 *  F. project_photos        — picha za maendeleo (image uploads via R2)
 *  G. land_assets           — ardhi na majengo (§9) — plots & buildings
 *                             linked optionally to a project
 *
 * Seed data
 * ─────────
 *  • project_status ENUM values (planning → active → on_hold → completed → cancelled)
 *  • contract_status ENUM values
 *  • payment_method ENUM values
 *
 * Run after BSS-KKKT-2026-007.
 *
 * Usage:
 *   node backend/migrate-projects.js
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
  console.log('║  KKKT — Projects Module Migration                    ║');
  console.log('║  Ref: BSS-KKKT-2026-008                             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {

    // ── A. projects ───────────────────────────────────────────────────────────
    //
    // Core project record — §13 Miradi ya Usharika.
    //
    // `status`:
    //   planning   — Inapangwa (not yet started)
    //   active     — Inaendelea (in progress)
    //   on_hold    — Imesimamishwa (paused)
    //   completed  — Imekamilika
    //   cancelled  — Imefutwa
    //
    // `progress_pct`: 0–100 integer — percentage complete.
    //   Updated manually or derived from milestones.
    //
    // `supervised_by_id`: FK to users — the church member overseeing the project.
    //   Maps to PDF field "Mtu anayesimamia".
    //
    // `land_asset_id`: optional FK to land_assets — the plot/building this
    //   project is physically located on (§9 cross-ref).
    //
    console.log('── A. projects table');

    await run('projects table', `
      CREATE TABLE IF NOT EXISTS projects (
        id                  INT             NOT NULL AUTO_INCREMENT,

        -- ── Identity ───────────────────────────────────────────────────────
        name                VARCHAR(255)    NOT NULL
                              COMMENT 'Jina la Mradi',
        description         TEXT            NULL
                              COMMENT 'Maelezo ya mradi',
        project_type        VARCHAR(100)    NULL
                              COMMENT 'Aina: Ujenzi, Barabara, Mifereji, Uzio, n.k.',

        -- ── Status & progress ──────────────────────────────────────────────
        status              ENUM(
                              'planning',
                              'active',
                              'on_hold',
                              'completed',
                              'cancelled'
                            ) NOT NULL DEFAULT 'planning'
                              COMMENT 'Hali ya mradi',
        progress_pct        TINYINT UNSIGNED NOT NULL DEFAULT 0
                              COMMENT 'Maendeleo ya mradi (0–100%)',

        -- ── Dates ──────────────────────────────────────────────────────────
        start_date          DATE            NULL
                              COMMENT 'Tarehe ya kuanza',
        expected_end_date   DATE            NULL
                              COMMENT 'Tarehe ya kukamilika iliyopangwa',
        actual_end_date     DATE            NULL
                              COMMENT 'Tarehe ya kukamilika halisi',

        -- ── Financials (summary level) ─────────────────────────────────────
        budget              DECIMAL(18, 2)  NULL
                              COMMENT 'Bajeti ya mradi (TShs)',
        total_paid          DECIMAL(18, 2)  NOT NULL DEFAULT 0.00
                              COMMENT 'Jumla iliyolipwa hadi sasa (denormalised, updated by trigger/app)',

        -- ── People ─────────────────────────────────────────────────────────
        supervised_by_id    INT             NULL
                              COMMENT 'FK to users — Msimamizi wa mradi',

        -- ── Location link ──────────────────────────────────────────────────
        land_asset_id       INT             NULL
                              COMMENT 'FK to land_assets — eneo la mradi (optional)',

        -- ── Notes ──────────────────────────────────────────────────────────
        notes               TEXT            NULL,

        -- ── Timestamps ─────────────────────────────────────────────────────
        created_by_id       INT             NULL
                              COMMENT 'FK to users — aliyeunda rekodi',
        created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_proj_supervised_by
          FOREIGN KEY (supervised_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_proj_created_by
          FOREIGN KEY (created_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_proj_status       (status),
        INDEX idx_proj_start_date   (start_date),
        INDEX idx_proj_supervised   (supervised_by_id)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Miradi ya Usharika — church project records (§13)'
    `);

    // ── B. project_contracts ──────────────────────────────────────────────────
    //
    // One project can have multiple contracts (e.g. phased construction).
    // Each contract has its own value, timeline, and status.
    //
    // `contract_status`:
    //   draft      — Rasimu (not yet signed)
    //   active     — Inatekelezwa
    //   completed  — Imekamilika
    //   terminated — Imesimamishwa / Imevunjwa
    //   disputed   — Ina Mgogoro
    //
    // `contract_value`: original signed amount (TShs).
    // `revised_value`:  updated after any variations (NULL = no changes yet).
    //
    console.log('\n── B. project_contracts table');

    await run('project_contracts table', `
      CREATE TABLE IF NOT EXISTS project_contracts (
        id                  INT             NOT NULL AUTO_INCREMENT,
        project_id          INT             NOT NULL,

        -- ── Identity ───────────────────────────────────────────────────────
        contract_number     VARCHAR(100)    NULL
                              COMMENT 'Namba ya mkataba',
        title               VARCHAR(255)    NOT NULL
                              COMMENT 'Jina la mkataba',
        contractor_name     VARCHAR(255)    NULL
                              COMMENT 'Jina la mkandarasi / kampuni',
        contractor_contact  VARCHAR(255)    NULL
                              COMMENT 'Simu / barua pepe ya mkandarasi',

        -- ── Scope ──────────────────────────────────────────────────────────
        scope_of_work       TEXT            NULL
                              COMMENT 'Kazi inayohusika',

        -- ── Financials ─────────────────────────────────────────────────────
        contract_value      DECIMAL(18, 2)  NOT NULL DEFAULT 0.00
                              COMMENT 'Thamani ya mkataba iliyosainiwa (TShs)',
        revised_value       DECIMAL(18, 2)  NULL
                              COMMENT 'Thamani iliyorekebishwa baada ya variations',
        retention_pct       DECIMAL(5, 2)   NULL
                              COMMENT 'Asilimia ya Retention (kawaida 5–10%)',

        -- ── Dates ──────────────────────────────────────────────────────────
        signed_date         DATE            NULL
                              COMMENT 'Tarehe ya kusaini',
        start_date          DATE            NULL,
        expected_end_date   DATE            NULL,
        actual_end_date     DATE            NULL,

        -- ── Status ─────────────────────────────────────────────────────────
        contract_status     ENUM(
                              'draft',
                              'active',
                              'completed',
                              'terminated',
                              'disputed'
                            ) NOT NULL DEFAULT 'draft'
                              COMMENT 'Hali ya mkataba',

        -- ── People ─────────────────────────────────────────────────────────
        supervised_by_id    INT             NULL
                              COMMENT 'FK to users — Msimamizi wa mkataba',

        notes               TEXT            NULL,
        created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_pc_project
          FOREIGN KEY (project_id) REFERENCES projects (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_pc_supervised_by
          FOREIGN KEY (supervised_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_pc_project        (project_id),
        INDEX idx_pc_status         (contract_status),
        INDEX idx_pc_contractor     (contractor_name(50))

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Mikataba ya miradi — contracts per project (§10)'
    `);

    // ── C. contract_variations ────────────────────────────────────────────────
    //
    // A variation (VO) is a formal change to the contract scope or value.
    // Each VO has its own amount (positive = additional cost, negative = saving).
    //
    // `approved_by_id`: the church official who approved the variation.
    //
    console.log('\n── C. contract_variations table');

    await run('contract_variations table', `
      CREATE TABLE IF NOT EXISTS contract_variations (
        id                  INT             NOT NULL AUTO_INCREMENT,
        contract_id         INT             NOT NULL,
        project_id          INT             NOT NULL
                              COMMENT 'Denormalised for easy querying',

        -- ── Identity ───────────────────────────────────────────────────────
        variation_number    SMALLINT        NOT NULL DEFAULT 1
                              COMMENT 'Sequential VO number within the contract',
        title               VARCHAR(255)    NOT NULL
                              COMMENT 'Jina / kichwa cha variation',
        description         TEXT            NULL,

        -- ── Financials ─────────────────────────────────────────────────────
        amount              DECIMAL(18, 2)  NOT NULL DEFAULT 0.00
                              COMMENT 'Kiasi cha variation (+ = nyongeza, - = punguzo)',

        -- ── Status ─────────────────────────────────────────────────────────
        status              ENUM('pending','approved','rejected')
                              NOT NULL DEFAULT 'pending'
                              COMMENT 'Hali ya variation',

        -- ── Approval ───────────────────────────────────────────────────────
        approved_by_id      INT             NULL
                              COMMENT 'FK to users — aliyeidhinisha',
        approved_date       DATE            NULL,

        notes               TEXT            NULL,
        created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_cv_contract
          FOREIGN KEY (contract_id) REFERENCES project_contracts (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_cv_project
          FOREIGN KEY (project_id) REFERENCES projects (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_cv_approved_by
          FOREIGN KEY (approved_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        UNIQUE KEY uq_cv_contract_number (contract_id, variation_number),

        INDEX idx_cv_contract  (contract_id),
        INDEX idx_cv_project   (project_id),
        INDEX idx_cv_status    (status)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Contract variations / change orders per contract'
    `);

    // ── D. project_payments ───────────────────────────────────────────────────
    //
    // Payment records per contract.
    // Cross-references §7 (Uwakili na Michango) via receipt_number.
    //
    // `payment_type`:
    //   advance      — Malipo ya awali (mobilisation advance)
    //   interim      — Malipo ya kati (progress payment)
    //   final        — Malipo ya mwisho
    //   retention    — Kutolewa kwa retention
    //   variation    — Malipo ya variation order
    //
    // `payment_method`:
    //   bank_transfer — Benki
    //   cheque        — Hundi
    //   mobile_money  — M-Pesa / Tigo Pesa / Airtel
    //   cash          — Taslimu
    //
    console.log('\n── D. project_payments table');

    await run('project_payments table', `
      CREATE TABLE IF NOT EXISTS project_payments (
        id                  INT             NOT NULL AUTO_INCREMENT,
        project_id          INT             NOT NULL,
        contract_id         INT             NULL
                              COMMENT 'NULL = project-level payment not tied to a contract',

        -- ── Identity ───────────────────────────────────────────────────────
        payment_type        ENUM(
                              'advance',
                              'interim',
                              'final',
                              'retention',
                              'variation',
                              'other'
                            ) NOT NULL DEFAULT 'interim'
                              COMMENT 'Aina ya malipo',

        payment_number      VARCHAR(100)    NULL
                              COMMENT 'Namba ya malipo (payment certificate no.)',
        receipt_number      VARCHAR(100)    NULL
                              COMMENT 'Namba ya risiti — cross-ref §7',

        -- ── Financials ─────────────────────────────────────────────────────
        amount              DECIMAL(18, 2)  NOT NULL
                              COMMENT 'Kiasi kilicholipwa (TShs)',
        payment_method      ENUM(
                              'bank_transfer',
                              'cheque',
                              'mobile_money',
                              'cash'
                            ) NOT NULL DEFAULT 'bank_transfer'
                              COMMENT 'Njia ya malipo',

        -- ── Dates ──────────────────────────────────────────────────────────
        payment_date        DATE            NOT NULL
                              COMMENT 'Tarehe ya malipo',

        -- ── Period (for interim payments) ──────────────────────────────────
        period_from         DATE            NULL
                              COMMENT 'Kipindi: kuanzia',
        period_to           DATE            NULL
                              COMMENT 'Kipindi: hadi',

        -- ── Approval ───────────────────────────────────────────────────────
        approved_by_id      INT             NULL
                              COMMENT 'FK to users — aliyeidhinisha malipo',

        -- ── Progress at time of payment ────────────────────────────────────
        progress_pct_at_payment TINYINT UNSIGNED NULL
                              COMMENT 'Maendeleo ya mradi wakati wa malipo (0–100%)',

        description         TEXT            NULL
                              COMMENT 'Maelezo / notes',
        created_by_id       INT             NULL,
        created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_pp_project
          FOREIGN KEY (project_id) REFERENCES projects (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_pp_contract
          FOREIGN KEY (contract_id) REFERENCES project_contracts (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_pp_approved_by
          FOREIGN KEY (approved_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_pp_created_by
          FOREIGN KEY (created_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_pp_project      (project_id),
        INDEX idx_pp_contract     (contract_id),
        INDEX idx_pp_date         (payment_date),
        INDEX idx_pp_type         (payment_type),
        INDEX idx_pp_receipt      (receipt_number)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Malipo ya miradi — payment records per project/contract (§7 cross-ref)'
    `);

    // ── E. project_documents ──────────────────────────────────────────────────
    //
    // General document attachments (PDF, Word, Excel, etc.)
    // Uploaded to R2 under prefix: projects/documents/
    //
    // `document_type`:
    //   contract    — Mkataba
    //   variation   — Variation Order
    //   certificate — Cheti (completion / payment certificate)
    //   permit      — Kibali (building permit, etc.)
    //   report      — Ripoti ya maendeleo
    //   invoice     — Ankara
    //   other       — Nyingine
    //
    console.log('\n── E. project_documents table');

    await run('project_documents table', `
      CREATE TABLE IF NOT EXISTS project_documents (
        id                  INT             NOT NULL AUTO_INCREMENT,
        project_id          INT             NOT NULL,
        contract_id         INT             NULL
                              COMMENT 'Optional: link to a specific contract',

        -- ── File info ──────────────────────────────────────────────────────
        document_type       ENUM(
                              'contract',
                              'variation',
                              'certificate',
                              'permit',
                              'report',
                              'invoice',
                              'plan',
                              'other'
                            ) NOT NULL DEFAULT 'other'
                              COMMENT 'Aina ya nyaraka',
        title               VARCHAR(255)    NOT NULL
                              COMMENT 'Jina la nyaraka',
        file_url            VARCHAR(500)    NOT NULL
                              COMMENT 'R2 path/URL',
        file_size_kb        INT             NULL,
        mime_type           VARCHAR(100)    NULL,

        -- ── Reference ──────────────────────────────────────────────────────
        reference_number    VARCHAR(100)    NULL
                              COMMENT 'Reference / document number',
        document_date       DATE            NULL
                              COMMENT 'Tarehe ya nyaraka',

        -- ── Access ─────────────────────────────────────────────────────────
        confidential        TINYINT(1)      NOT NULL DEFAULT 0
                              COMMENT '1 = Siri (visible to pastor/elder only)',

        uploaded_by_id      INT             NULL,
        uploaded_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_pd_project
          FOREIGN KEY (project_id) REFERENCES projects (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_pd_contract
          FOREIGN KEY (contract_id) REFERENCES project_contracts (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_pd_uploaded_by
          FOREIGN KEY (uploaded_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_pd_project  (project_id),
        INDEX idx_pd_type     (document_type),
        INDEX idx_pd_contract (contract_id)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Nyaraka za miradi — project document attachments via R2'
    `);

    // ── F. project_photos ─────────────────────────────────────────────────────
    //
    // Progress photos — picha za maendeleo.
    // Kept separate from documents because they:
    //   • are always images (jpg/webp/png)
    //   • have a caption and a progress_pct snapshot
    //   • will likely be rendered in a gallery view
    //
    // Uploaded to R2 under prefix: projects/photos/
    //
    console.log('\n── F. project_photos table');

    await run('project_photos table', `
      CREATE TABLE IF NOT EXISTS project_photos (
        id                  INT             NOT NULL AUTO_INCREMENT,
        project_id          INT             NOT NULL,

        -- ── File info ──────────────────────────────────────────────────────
        file_url            VARCHAR(500)    NOT NULL
                              COMMENT 'R2 path/URL to image',
        thumbnail_url       VARCHAR(500)    NULL
                              COMMENT 'Optional: smaller preview version',
        file_size_kb        INT             NULL,
        mime_type           VARCHAR(100)    NULL,

        -- ── Context ────────────────────────────────────────────────────────
        caption             VARCHAR(500)    NULL
                              COMMENT 'Maelezo ya picha',
        taken_date          DATE            NULL
                              COMMENT 'Tarehe picha ilipopigwa',
        progress_pct_at_photo TINYINT UNSIGNED NULL
                              COMMENT 'Maendeleo ya mradi wakati picha ilipopigwa',
        location_note       VARCHAR(255)    NULL
                              COMMENT 'Eneo ndani ya mradi (mfano: "Upande wa Kaskazini")',

        -- ── Sort ───────────────────────────────────────────────────────────
        sort_order          INT             NOT NULL DEFAULT 0,

        uploaded_by_id      INT             NULL,
        uploaded_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_pph_project
          FOREIGN KEY (project_id) REFERENCES projects (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_pph_uploaded_by
          FOREIGN KEY (uploaded_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_pph_project    (project_id),
        INDEX idx_pph_taken_date (taken_date),
        INDEX idx_pph_sort       (project_id, sort_order)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Picha za maendeleo ya miradi — progress photos via R2'
    `);

    // ── G. land_assets ────────────────────────────────────────────────────────
    //
    // §9 Ardhi na Majengo — plots and buildings owned by the church.
    // A land asset can exist independently (the church's land register),
    // or be linked to a project (construction on that plot).
    //
    // `asset_type`:
    //   land       — Ardhi / Kiwanja
    //   building   — Jengo
    //   both       — Ardhi na Jengo
    //
    // `ownership_status`:
    //   owned      — Miliki Kamili
    //   leased     — Kwa Pango
    //   in_process — Inaendelea (title transfer, etc.)
    //
    console.log('\n── G. land_assets table');

    await run('land_assets table', `
      CREATE TABLE IF NOT EXISTS land_assets (
        id                  INT             NOT NULL AUTO_INCREMENT,

        -- ── Identity ───────────────────────────────────────────────────────
        name                VARCHAR(255)    NOT NULL
                              COMMENT 'Jina la mali (mfano: "Kiwanja cha Kanisa Kuu")',
        asset_type          ENUM('land','building','both')
                              NOT NULL DEFAULT 'land'
                              COMMENT 'Aina ya mali',

        -- ── Legal / registration ───────────────────────────────────────────
        plot_number         VARCHAR(100)    NULL
                              COMMENT 'Plot / Title No.',
        title_deed_number   VARCHAR(100)    NULL
                              COMMENT 'Namba ya Hati Miliki',
        ownership_status    ENUM('owned','leased','in_process')
                              NOT NULL DEFAULT 'owned'
                              COMMENT 'Hali ya umiliki',

        -- ── Location ───────────────────────────────────────────────────────
        area_name           VARCHAR(255)    NULL
                              COMMENT 'Eneo / Mtaa',
        region              VARCHAR(100)    NULL
                              COMMENT 'Mkoa',
        gps_lat             DECIMAL(10, 7)  NULL,
        gps_lng             DECIMAL(10, 7)  NULL,

        -- ── Physical ───────────────────────────────────────────────────────
        area_sqm            DECIMAL(12, 2)  NULL
                              COMMENT 'Ukubwa wa kiwanja (mita za mraba)',
        \`usage\`             VARCHAR(255)    NULL
                              COMMENT 'Matumizi (Kanisa, Makazi, Biashara, n.k.)',

        -- ── Financials ─────────────────────────────────────────────────────
        valuation           DECIMAL(18, 2)  NULL
                              COMMENT 'Thamani ya tathmini (TShs)',
        valuation_date      DATE            NULL,

        -- ── Responsible person ─────────────────────────────────────────────
        responsible_id      INT             NULL
                              COMMENT 'FK to users — Kiongozi / Msimamizi',

        -- ── Description & notes ────────────────────────────────────────────
        description         TEXT            NULL
                              COMMENT 'Maelezo zaidi, mipaka, n.k.',
        notes               TEXT            NULL,

        is_active           TINYINT(1)      NOT NULL DEFAULT 1,
        created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_la_responsible
          FOREIGN KEY (responsible_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_la_type   (asset_type),
        INDEX idx_la_status (ownership_status),
        INDEX idx_la_active (is_active)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Ardhi na majengo ya usharika — land and building assets (§9)'
    `);

    // ── Add FK from projects → land_assets (now that land_assets exists) ──────
    await run('fk_proj_land_asset foreign key', `
      ALTER TABLE projects
        ADD CONSTRAINT fk_proj_land_asset
          FOREIGN KEY (land_asset_id) REFERENCES land_assets (id)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);

    await run('idx_proj_land_asset index', `
      ALTER TABLE projects ADD INDEX idx_proj_land_asset (land_asset_id)
    `);

    // ── H. land_asset_documents ───────────────────────────────────────────────
    //
    // Document attachments for land/building assets:
    // title deeds, boundary maps, ownership transfer docs, contracts.
    //
    console.log('\n── H. land_asset_documents table');

    await run('land_asset_documents table', `
      CREATE TABLE IF NOT EXISTS land_asset_documents (
        id                  INT             NOT NULL AUTO_INCREMENT,
        land_asset_id       INT             NOT NULL,

        document_type       ENUM(
                              'title_deed',
                              'survey_plan',
                              'boundary_map',
                              'lease_agreement',
                              'transfer_deed',
                              'valuation_report',
                              'other'
                            ) NOT NULL DEFAULT 'other'
                              COMMENT 'Aina ya nyaraka',
        title               VARCHAR(255)    NOT NULL,
        file_url            VARCHAR(500)    NOT NULL
                              COMMENT 'R2 path/URL',
        file_size_kb        INT             NULL,
        mime_type           VARCHAR(100)    NULL,
        document_date       DATE            NULL,
        confidential        TINYINT(1)      NOT NULL DEFAULT 1
                              COMMENT '1 = Siri (land docs are sensitive by default)',
        uploaded_by_id      INT             NULL,
        uploaded_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        CONSTRAINT fk_lad_asset
          FOREIGN KEY (land_asset_id) REFERENCES land_assets (id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_lad_uploaded_by
          FOREIGN KEY (uploaded_by_id) REFERENCES users (id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        INDEX idx_lad_asset (land_asset_id),
        INDEX idx_lad_type  (document_type)

      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Nyaraka za ardhi na majengo — land asset documents via R2'
    `);

    // ── I. Indexes ────────────────────────────────────────────────────────────
    console.log('\n── I. Additional indexes');

    await run('idx_projects_status_start composite', `
      ALTER TABLE projects
        ADD INDEX idx_proj_status_start (status, start_date)
    `);

    await run('idx_project_payments_project_date composite', `
      ALTER TABLE project_payments
        ADD INDEX idx_pp_proj_date (project_id, payment_date)
    `);

    // ── Verify ────────────────────────────────────────────────────────────────
    console.log('\n── Verifying...');

    const [tables] = await pool.query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'projects', 'project_contracts', 'contract_variations',
          'project_payments', 'project_documents', 'project_photos',
          'land_assets', 'land_asset_documents'
        )
      ORDER BY TABLE_NAME
    `);

    const [[{ proj_count }]]     = await pool.query('SELECT COUNT(*) AS proj_count FROM projects');
    const [[{ land_count }]]     = await pool.query('SELECT COUNT(*) AS land_count FROM land_assets');
    const [[{ contract_count }]] = await pool.query('SELECT COUNT(*) AS contract_count FROM project_contracts');

    console.log(`\n✅  Migration BSS-KKKT-2026-008 complete.\n`);
    console.log(`📋  Tables created (${tables.length}/8):`);
    tables.forEach(t =>
      console.log(`   • ${t.TABLE_NAME.padEnd(28)} — ${t.TABLE_COMMENT}`)
    );
    console.log(`\n📋  Initial row counts:`);
    console.log(`   • projects            : ${proj_count}`);
    console.log(`   • land_assets         : ${land_count}`);
    console.log(`   • project_contracts   : ${contract_count}`);
    console.log(`\n📋  Module summary:`);
    console.log(`   §13 Miradi      → projects + project_contracts + contract_variations`);
    console.log(`                     + project_payments + project_documents + project_photos`);
    console.log(`   §10 Mikataba    → project_contracts + contract_variations`);
    console.log(`   §9  Ardhi       → land_assets + land_asset_documents`);
    console.log(`   §7  Cross-ref   → project_payments.receipt_number`);
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