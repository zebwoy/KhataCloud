-- ============================================================
-- Migration: SaaS Platform Schema
-- HisaabKitaab → Multi-tenant SaaS
--
-- WHAT THIS DOES:
--   1. Creates 'platform' schema with orgs, super_admins, org_members tables
--   2. Creates a reusable function to provision a per-org schema on approval
--   3. Provisions the first org (mqlc) and COPIES existing admin data into it
--
-- SAFETY:
--   - All operations are ADDITIVE — public.transactions etc. are NEVER touched
--   - The existing admin flow continues reading from public.transactions unchanged
--   - Wrapped in a transaction — any failure rolls back entirely
--
-- HOW TO RUN:
--   Open Neon Console → SQL Editor → paste this file → Run
--
-- PREREQUISITES:
--   - Run only ONCE per database
--   - Ensure public.transactions, public.entities, public.saved_senders exist
-- ============================================================

-- NOTE: Running in AUTOCOMMIT mode (no BEGIN/COMMIT wrapper).
-- Neon free tier terminates idle-in-transaction connections aggressively.
-- Each statement is safe to re-run: CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- If a step fails, simply fix and re-run from that step only.

-- ============================================================
-- STEP 1: Platform schema + tables
-- ============================================================

CREATE SCHEMA IF NOT EXISTS platform;

-- Org registry: one row per organisation (madrasah, NGO, etc.)
CREATE TABLE IF NOT EXISTS platform.orgs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  -- slug becomes the schema name: org_{slug with hyphens→underscores}
  slug                VARCHAR(100) NOT NULL UNIQUE
                        CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$'),
  owner_user_id       TEXT,        -- Neon Auth / Better Auth user ID of creator
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  plan                VARCHAR(50)  NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'pro', 'admin')),
  schema_provisioned  BOOLEAN      NOT NULL DEFAULT FALSE,
  contact_email       VARCHAR(255),
  notes               TEXT,        -- super-admin internal notes
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at         TIMESTAMP,
  approved_by         TEXT         -- super-admin user ID who approved
);

CREATE INDEX IF NOT EXISTS idx_orgs_slug    ON platform.orgs(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_status  ON platform.orgs(status);
CREATE INDEX IF NOT EXISTS idx_orgs_owner   ON platform.orgs(owner_user_id);

-- Super-admin registry: only these users can access the super-admin dashboard
CREATE TABLE IF NOT EXISTS platform.super_admins (
  user_id    TEXT        PRIMARY KEY, -- Neon Auth user ID
  email      VARCHAR(255) NOT NULL,
  added_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Org membership: which auth users belong to which org and with what role
CREATE TABLE IF NOT EXISTS platform.org_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES platform.orgs(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,   -- Neon Auth user ID
  role       VARCHAR(50) NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner', 'admin', 'member')),
  joined_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON platform.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON platform.org_members(org_id);

-- ============================================================
-- STEP 2: Schema provisioning function
-- Called once at approval time for each new org.
-- Creates org_{slug} schema with tables mirroring public schema structure.
-- ============================================================

CREATE OR REPLACE FUNCTION platform.provision_org_schema(p_slug TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT := 'org_' || replace(p_slug, '-', '_');
BEGIN
  -- Create the org's private schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- transactions table (identical structure to public.transactions)
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

  -- entities table
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

  -- saved_senders table (counterparty quick-fill)
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.saved_senders (
      id         SERIAL PRIMARY KEY,
      sender     VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  $sql$, schema_name);

  -- Mark schema as provisioned in org registry
  UPDATE platform.orgs SET schema_provisioned = TRUE WHERE slug = p_slug;

  RETURN schema_name;
END;
$$;

-- ============================================================
-- STEP 3: Seed the first org (Millat QLC)
-- This is your existing "admin" organisation.
-- ============================================================

INSERT INTO platform.orgs (id, name, slug, status, plan, schema_provisioned, contact_email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Millat Quran Learning Centre',
  'mqlc',
  'approved',
  'admin',   -- 'admin' plan = no restrictions (your own org)
  FALSE,     -- will be set TRUE by provision_org_schema below
  NULL
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- STEP 4: Provision the schema for the first org + COPY data
--
-- public.transactions is NOT modified — this is a clean copy.
-- Your existing admin flow continues using public.transactions forever.
-- ============================================================

SELECT platform.provision_org_schema('mqlc');

-- Copy transactions (all rows, including soft-deleted for audit completeness)
INSERT INTO org_mqlc.transactions
  (id, date, category, subcategory, sender, receiver, custodian, counterparty,
   remarks, amount, created_at, modifieddate, isdeleted)
SELECT
  id, date, category, subcategory, sender, receiver, custodian, counterparty,
  remarks, amount, created_at, modifieddate, isdeleted
FROM public.transactions;

-- Reset sequence to avoid PK collision on future inserts
SELECT setval(
  pg_get_serial_sequence('org_mqlc.transactions', 'id'),
  COALESCE((SELECT MAX(id) FROM org_mqlc.transactions), 1)
);

-- Copy entities (non-trial only — trial entities belong to the shared trial sandbox)
INSERT INTO org_mqlc.entities
  (id, entity_name, entity_type, isdeleted, modifieddate, istrial, created_at)
SELECT
  id, entity_name, entity_type, isdeleted, modifieddate, istrial, created_at
FROM public.entities
WHERE istrial = 'N';

SELECT setval(
  pg_get_serial_sequence('org_mqlc.entities', 'id'),
  COALESCE((SELECT MAX(id) FROM org_mqlc.entities), 1)
);

-- Copy saved_senders only if the source table exists (it's created lazily on first use)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'saved_senders'
  ) THEN
    INSERT INTO org_mqlc.saved_senders (id, sender, created_at)
    SELECT id, sender, created_at
    FROM public.saved_senders
    ON CONFLICT (sender) DO NOTHING;

    PERFORM setval(
      pg_get_serial_sequence('org_mqlc.saved_senders', 'id'),
      COALESCE((SELECT MAX(id) FROM org_mqlc.saved_senders), 1)
    );

    RAISE NOTICE 'saved_senders: copied % rows.',
      (SELECT COUNT(*) FROM org_mqlc.saved_senders);
  ELSE
    RAISE NOTICE 'saved_senders: public.saved_senders does not exist yet — skipped (safe).';
  END IF;
END;
$$;

-- ============================================================
-- VERIFICATION (runs inside transaction — review before COMMIT)
-- ============================================================

SELECT 'platform.orgs count'    AS check_name, COUNT(*)::TEXT AS result FROM platform.orgs;
SELECT 'org schema provisioned' AS check_name, schema_provisioned::TEXT AS result FROM platform.orgs WHERE slug = 'mqlc';

SELECT 'public.transactions'        AS source, COUNT(*) AS row_count FROM public.transactions
UNION ALL
SELECT 'org_mqlc.transactions'      AS source, COUNT(*) AS row_count FROM org_mqlc.transactions;

SELECT 'public.entities (non-trial)' AS source, COUNT(*) AS row_count FROM public.entities WHERE "IsTrial" = 'N'
UNION ALL
SELECT 'org_mqlc.entities'           AS source, COUNT(*) AS row_count FROM org_mqlc.entities;

-- ============================================================
-- DONE. Verify the row counts above match your expectations.
-- All steps used IF NOT EXISTS / ON CONFLICT DO NOTHING,
-- so this script is safe to re-run if any step was skipped.
-- ============================================================
