-- ============================================================
-- Migration 002: Clerk B2B Organizations
-- HisaabKitaab — Multi-tenant auth via Clerk
--
-- RUN IN: Neon Console → SQL Editor
-- SAFE:   All CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
--         Safe to re-run if any step was interrupted.
-- ============================================================

-- ── STEP 1: Add Clerk columns to platform.orgs ────────────────────────────────
ALTER TABLE platform.orgs
  ADD COLUMN IF NOT EXISTS clerk_org_id       VARCHAR(64)  UNIQUE,
  ADD COLUMN IF NOT EXISTS accepting_requests BOOLEAN      NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orgs_clerk_org_id
  ON platform.orgs(clerk_org_id);

-- ── STEP 2: Join requests table ───────────────────────────────────────────────
-- Stores pending/approved/rejected requests by users to join an org.
-- Active memberships live in Clerk; this table only tracks the request lifecycle.
CREATE TABLE IF NOT EXISTS platform.join_requests (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(64)  NOT NULL,
  org_id        UUID         NOT NULL REFERENCES platform.orgs(id) ON DELETE CASCADE,
  status        VARCHAR(16)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  message       TEXT,
  requested_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_by   VARCHAR(64),          -- Clerk user ID of org admin who acted
  reviewed_at   TIMESTAMPTZ,
  UNIQUE(user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_user_id
  ON platform.join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_org_pending
  ON platform.join_requests(org_id, status) WHERE status = 'pending';

-- ── STEP 3: Audit log for MQLC (existing org) ────────────────────────────────
-- Future orgs get this automatically via the updated provision_org_schema().
CREATE TABLE IF NOT EXISTS org_mqlc.audit_log (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     VARCHAR(64)  NOT NULL,
  user_role   VARCHAR(32)  NOT NULL,   -- 'org:admin' | 'org:member' | 'super_admin'
  action      VARCHAR(64)  NOT NULL,   -- 'create_transaction' | 'delete_entity' | etc.
  entity_type VARCHAR(64),
  entity_id   VARCHAR(64),
  summary     TEXT,
  ip_addr     VARCHAR(64),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mqlc_audit_created
  ON org_mqlc.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mqlc_audit_user
  ON org_mqlc.audit_log(user_id);

-- ── STEP 4: Update provision_org_schema() to include audit_log ───────────────
-- This ensures ALL future orgs get audit_log automatically.
CREATE OR REPLACE FUNCTION platform.provision_org_schema(p_slug TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT := 'org_' || replace(p_slug, '-', '_');
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- transactions
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.transactions (
      id            SERIAL PRIMARY KEY,
      date          DATE         NOT NULL,
      category      VARCHAR(20)  NOT NULL CHECK (category IN ('Income', 'Expense', 'Transfer')),
      subcategory   VARCHAR(100),
      sender        VARCHAR(255),
      receiver      VARCHAR(255),
      custodian     VARCHAR(255),
      counterparty  VARCHAR(255),
      remarks       TEXT,
      amount        DECIMAL(15, 2) NOT NULL,
      created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      modifieddate  TIMESTAMP,
      isdeleted     CHAR(1)      DEFAULT 'N' CHECK (isdeleted IN ('Y', 'N'))
    )
  $sql$, schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_date ON %I.transactions(date)',
    replace(schema_name, '-', '_'), schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_isdeleted ON %I.transactions(isdeleted)',
    replace(schema_name, '-', '_'), schema_name);

  -- entities
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.entities (
      id           SERIAL PRIMARY KEY,
      entity_name  VARCHAR(255) NOT NULL UNIQUE,
      entity_type  VARCHAR(50)  NOT NULL
                     CHECK (entity_type IN ('trustee', 'donor', 'vendor', 'other')),
      isdeleted    CHAR(1)      DEFAULT 'N' CHECK (isdeleted IN ('Y', 'N')),
      modifieddate TIMESTAMP,
      istrial      CHAR(1)      DEFAULT 'N' CHECK (istrial IN ('Y', 'N')),
      created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  $sql$, schema_name);

  -- saved_senders
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.saved_senders (
      id         SERIAL PRIMARY KEY,
      sender     VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  $sql$, schema_name);

  -- audit_log (NEW — tracks all data changes within this org)
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.audit_log (
      id          BIGSERIAL    PRIMARY KEY,
      user_id     VARCHAR(64)  NOT NULL,
      user_role   VARCHAR(32)  NOT NULL,
      action      VARCHAR(64)  NOT NULL,
      entity_type VARCHAR(64),
      entity_id   VARCHAR(64),
      summary     TEXT,
      ip_addr     VARCHAR(64),
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  $sql$, schema_name);

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_audit_created ON %I.audit_log(created_at DESC)',
    replace(schema_name, '-', '_'), schema_name);
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_audit_user ON %I.audit_log(user_id)',
    replace(schema_name, '-', '_'), schema_name);

  UPDATE platform.orgs SET schema_provisioned = TRUE WHERE slug = p_slug;
  RETURN schema_name;
END;
$$;

-- ── VERIFICATION ─────────────────────────────────────────────────────────────
SELECT 'platform.orgs columns' AS check,
  string_agg(column_name, ', ' ORDER BY ordinal_position) AS result
FROM information_schema.columns
WHERE table_schema = 'platform' AND table_name = 'orgs';

SELECT 'join_requests table' AS check,
  COUNT(*)::TEXT AS result
FROM information_schema.tables
WHERE table_schema = 'platform' AND table_name = 'join_requests';

SELECT 'org_mqlc.audit_log table' AS check,
  COUNT(*)::TEXT AS result
FROM information_schema.tables
WHERE table_schema = 'org_mqlc' AND table_name = 'audit_log';

-- ── DONE ────────────────────────────────────────────────────────────────────
-- Next step: run scripts/migrate-to-clerk-orgs.ts to create Clerk org for MQLC
-- and migrate existing org_members to Clerk org membership.
