-- ============================================================
-- migration_audit_v2.sql
-- Audit Log v2: add human-readable name columns + typo fixes
--
-- Run once per org schema. Update the schema name below.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).
-- ============================================================

-- ── Step 1: Add new columns to org_mqlc.audit_log ────────────────────────────
-- Adjust 'org_mqlc' if you have other org schemas.

ALTER TABLE org_mqlc.audit_log
  ADD COLUMN IF NOT EXISTS user_name    TEXT,
  ADD COLUMN IF NOT EXISTS user_email   TEXT,
  ADD COLUMN IF NOT EXISTS target_name  TEXT,
  ADD COLUMN IF NOT EXISTS target_email TEXT,
  ADD COLUMN IF NOT EXISTS page_trail   TEXT;

-- ── Step 2: Fix typos in existing rows ───────────────────────────────────────
-- "rejectd" → "rejected"
UPDATE org_mqlc.audit_log
SET summary = REPLACE(summary, 'rejectd', 'rejected')
WHERE summary LIKE '%rejectd%';

-- Strip raw Clerk user IDs from summaries (replace "for user user_3H..." pattern)
UPDATE org_mqlc.audit_log
SET summary = REGEXP_REPLACE(
  summary,
  'for user user_[A-Za-z0-9]+',
  'for [user]',
  'g'
)
WHERE summary ~ 'for user user_[A-Za-z0-9]+';

-- Strip raw Clerk user IDs from entity_id display (leave entity_id intact for FK purposes,
-- but if summary says "Admin changed role of user_3H...", fix that too)
UPDATE org_mqlc.audit_log
SET summary = REGEXP_REPLACE(
  summary,
  'of user_[A-Za-z0-9]+',
  'of [user]',
  'g'
)
WHERE summary ~ 'of user_[A-Za-z0-9]+';

UPDATE org_mqlc.audit_log
SET summary = REGEXP_REPLACE(
  summary,
  'member user_[A-Za-z0-9]+',
  'member [user]',
  'g'
)
WHERE summary ~ 'member user_[A-Za-z0-9]+';

-- ── Step 3: Add index on action for KPI queries ───────────────────────────────
CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON org_mqlc.audit_log (action);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx
  ON org_mqlc.audit_log (user_id);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON org_mqlc.audit_log (created_at DESC);

-- ── Step 4: Update platform.provision_org_schema for future orgs ─────────────
-- So every new org schema automatically gets these columns from day one.
-- Must DROP first because PostgreSQL won't allow changing a function's return type
-- via CREATE OR REPLACE alone.

DROP FUNCTION IF EXISTS platform.provision_org_schema(TEXT);

CREATE OR REPLACE FUNCTION platform.provision_org_schema(p_slug TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT := 'org_' || REPLACE(p_slug, '-', '_');
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.transactions (
      id            SERIAL PRIMARY KEY,
      date          DATE NOT NULL,
      category      TEXT NOT NULL,
      subcategory   TEXT,
      custodian     TEXT,
      counterparty  TEXT,
      amount        NUMERIC(14,2) NOT NULL,
      remarks       TEXT,
      entered_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, schema_name);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.saved_senders (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, schema_name);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.audit_log (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT NOT NULL,
      user_name    TEXT,
      user_email   TEXT,
      user_role    TEXT NOT NULL,
      action       TEXT NOT NULL,
      entity_type  TEXT,
      entity_id    TEXT,
      target_name  TEXT,
      target_email TEXT,
      page_trail   TEXT,
      summary      TEXT,
      ip_addr      TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $sql$, schema_name);

  -- Indexes
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.audit_log (action)',
    schema_name || '_audit_action_idx', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.audit_log (user_id)',
    schema_name || '_audit_user_idx', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.audit_log (created_at DESC)',
    schema_name || '_audit_created_idx', schema_name);
END;
$$;

-- Done.
SELECT 'migration_audit_v2.sql completed successfully' AS status;
