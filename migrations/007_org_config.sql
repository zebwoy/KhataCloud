-- ============================================================
-- Migration 007: Org Config (CMS / Noticeboard settings)
-- Run once in Neon Dashboard SQL editor.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS is idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS org_config (
  org_slug    VARCHAR(100) NOT NULL,
  config_key  VARCHAR(100) NOT NULL DEFAULT 'noticeboard',
  config_json JSONB        NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (org_slug, config_key)
);

-- Index for fast lookup by org_slug
CREATE INDEX IF NOT EXISTS idx_org_config_slug
  ON org_config (org_slug);

-- ============================================================
-- config_json schema (noticeboard key):
-- {
--   "publicMessage": "We are running short this month…",
--   "donationLink":  "https://rzp.io/l/abc123",
--   "hiddenSubcategories": ["Salaries"]
-- }
-- ============================================================
