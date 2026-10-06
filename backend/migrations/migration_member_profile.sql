-- ============================================================
-- Migration: Extend member profile fields
-- Ref: BSS-KKKT-2026-001
-- Run once against your existing database.
-- All new columns are nullable so existing rows are unaffected.
-- ============================================================

-- ── 1. Personal details ──────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender            ENUM('Male','Female') NULL         AFTER phone,
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE                  NULL         AFTER gender,
  ADD COLUMN IF NOT EXISTS place_of_birth    VARCHAR(255)          NULL         AFTER date_of_birth,
  ADD COLUMN IF NOT EXISTS member_status     ENUM(
                                               'hai',          -- active/alive
                                               'amehamia',     -- transferred
                                               'amefariki'     -- deceased
                                             ) NOT NULL DEFAULT 'hai'           AFTER place_of_birth;

-- ── 2. Marital information ───────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marital_status         ENUM(
                                                    'Ameoa',        -- married (male)
                                                    'Hajaoa',       -- single (male)
                                                    'Ameolewa',     -- married (female)
                                                    'Hajaolewa',    -- single (female)
                                                    'Mjane',        -- widower (male)
                                                    'Mgane',        -- widow (female)
                                                    'Talikiwa',     -- divorced
                                                    'Tengana'       -- separated
                                                  ) NULL                        AFTER member_status,
  ADD COLUMN IF NOT EXISTS marriage_type          ENUM(
                                                    'Kikristo',     -- Christian marriage
                                                    'Siya Kikristo' -- Non-Christian
                                                  ) NULL                        AFTER marital_status,
  ADD COLUMN IF NOT EXISTS marriage_date          DATE          NULL             AFTER marriage_type,
  ADD COLUMN IF NOT EXISTS marriage_place         VARCHAR(255)  NULL             AFTER marriage_date,
  ADD COLUMN IF NOT EXISTS spouse_name            VARCHAR(255)  NULL             AFTER marriage_place,
  ADD COLUMN IF NOT EXISTS spouse_phone           VARCHAR(30)   NULL             AFTER spouse_name,
  ADD COLUMN IF NOT EXISTS cohabiting_partner_name VARCHAR(255) NULL             AFTER spouse_phone;

-- ── 3. Professional / education ──────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS occupation          VARCHAR(255) NULL  AFTER cohabiting_partner_name,
  ADD COLUMN IF NOT EXISTS workplace           VARCHAR(255) NULL  AFTER occupation,
  ADD COLUMN IF NOT EXISTS education           VARCHAR(255) NULL  AFTER workplace,
  ADD COLUMN IF NOT EXISTS profession          VARCHAR(255) NULL  AFTER education,
  ADD COLUMN IF NOT EXISTS willing_to_volunteer TINYINT(1)  NULL  AFTER profession;

-- ── 4. Residence & local contacts ────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS jumuiya                VARCHAR(255) NULL  AFTER willing_to_volunteer,
  ADD COLUMN IF NOT EXISTS block_no               VARCHAR(50)  NULL  AFTER jumuiya,
  ADD COLUMN IF NOT EXISTS area_name              VARCHAR(255) NULL  AFTER block_no,
  ADD COLUMN IF NOT EXISTS slp                    VARCHAR(100) NULL  AFTER area_name,
  ADD COLUMN IF NOT EXISTS neighbour_member_name  VARCHAR(255) NULL  AFTER slp,
  ADD COLUMN IF NOT EXISTS neighbour_member_phone VARCHAR(30)  NULL  AFTER neighbour_member_name,
  ADD COLUMN IF NOT EXISTS elder_name             VARCHAR(255) NULL  AFTER neighbour_member_phone,
  ADD COLUMN IF NOT EXISTS elder_phone            VARCHAR(30)  NULL  AFTER elder_name,
  ADD COLUMN IF NOT EXISTS previous_church        VARCHAR(255) NULL  AFTER elder_phone;

-- ── 5. Dependants table (children / waumini wanaokutegemea) ──
CREATE TABLE IF NOT EXISTS member_dependants (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  member_id       INT UNSIGNED    NOT NULL,
  full_name       VARCHAR(255)    NOT NULL,
  date_of_birth   DATE            NULL,
  relationship    VARCHAR(100)    NULL,          -- e.g. Mtoto, Ndugu, Mzazi
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_dep_member FOREIGN KEY (member_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_dep_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. Useful indexes ────────────────────────────────────────
ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_member_status  (member_status),
  ADD INDEX IF NOT EXISTS idx_gender         (gender),
  ADD INDEX IF NOT EXISTS idx_date_of_birth  (date_of_birth);

-- ============================================================
-- Done. Verify with:
--   DESCRIBE users;
--   DESCRIBE member_dependants;
-- ============================================================
