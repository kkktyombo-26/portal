-- ============================================================
-- Migration: Form Templates Feature
-- Run this against your church_portal database
-- ============================================================

USE church_portal;

-- Form templates (created by pastor / elder)
CREATE TABLE IF NOT EXISTS form_templates (
  id           INT           NOT NULL AUTO_INCREMENT,
  title_en     VARCHAR(255)  NOT NULL,
  title_sw     VARCHAR(255)  NOT NULL,
  description_en TEXT,
  description_sw TEXT,
  -- JSON array of field objects:
  -- [{ id, label_en, label_sw, type, required, options? }]
  -- type: text | textarea | number | date | select | checkbox
  fields       JSON          NOT NULL,
  scope        ENUM('church','group') NOT NULL DEFAULT 'church',
  group_id     INT           DEFAULT NULL,
  created_by   INT           NOT NULL,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (group_id)   REFERENCES groups(id)  ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index for faster lookups
CREATE INDEX idx_form_templates_scope    ON form_templates (scope);
CREATE INDEX idx_form_templates_active   ON form_templates (is_active);
CREATE INDEX idx_form_templates_created_by ON form_templates (created_by);