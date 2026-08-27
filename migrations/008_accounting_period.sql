-- ============================================================
-- Migration 008: Add accounting_period column
-- KhataCloud — Reconciliation & Period-accurate Filtering
--
-- WHAT THIS DOES:
--   1. Adds CHAR(7) accounting_period (YYYY-MM) to all transaction tables:
--      - public.transactions
--      - public.trial_transactions
--      - All org_* schemas (dynamically discovered)
--   2. Backfills existing rows: accounting_period = TO_CHAR(date, 'YYYY-MM')
--   3. Adds a BTREE index for fast period-based filtering
--   4. Updates platform.provision_org_schema() to include the column in
--      future org schemas automatically
--
-- SAFETY:
--   - ADD COLUMN IF NOT EXISTS  → idempotent, safe to re-run
--   - Backfill uses UPDATE WHERE accounting_period IS NULL → idempotent
--   - Wrapped in a DO block for clean error surface
--
-- HOW TO RUN:
--   Neon Console → SQL Editor → paste → Run
-- ============================================================

DO $$
DECLARE
  s_name TEXT;
BEGIN
  -- ── 1. Public legacy transactions table ──────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS accounting_period CHAR(7);

    UPDATE public.transactions
    SET accounting_period = TO_CHAR(date, 'YYYY-MM')
    WHERE accounting_period IS NULL AND date IS NOT NULL;

    RAISE NOTICE 'public.transactions: accounting_period added and backfilled.';
  END IF;

  -- ── 2. Trial transactions table ───────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trial_transactions'
  ) THEN
    ALTER TABLE public.trial_transactions
      ADD COLUMN IF NOT EXISTS accounting_period CHAR(7);

    UPDATE public.trial_transactions
    SET accounting_period = TO_CHAR(date, 'YYYY-MM')
    WHERE accounting_period IS NULL AND date IS NOT NULL;

    RAISE NOTICE 'public.trial_transactions: accounting_period added and backfilled.';
  END IF;

  -- ── 3. All org_* schemas (dynamically discovered) ─────────────────────────
  FOR s_name IN
    SELECT DISTINCT table_schema
    FROM information_schema.tables
    WHERE table_name = 'transactions'
      AND table_schema LIKE 'org_%'
    ORDER BY table_schema
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.transactions ADD COLUMN IF NOT EXISTS accounting_period CHAR(7)',
      s_name
    );

    EXECUTE format(
      'UPDATE %I.transactions SET accounting_period = TO_CHAR(date, ''YYYY-MM'') WHERE accounting_period IS NULL AND date IS NOT NULL',
      s_name
    );

    RAISE NOTICE 'Schema %: accounting_period added and backfilled.', s_name;
  END LOOP;

END $$;

-- ── 4. Add index on all org schemas for fast period filtering ─────────────────
DO $$
DECLARE
  s_name TEXT;
  idx_name TEXT;
BEGIN
  -- Index on public.transactions
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_accounting_period
      ON public.transactions (accounting_period);
  END IF;

  -- Index on public.trial_transactions
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trial_transactions'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_trial_transactions_accounting_period
      ON public.trial_transactions (accounting_period);
  END IF;

  -- Index on each org schema
  FOR s_name IN
    SELECT DISTINCT table_schema
    FROM information_schema.tables
    WHERE table_name = 'transactions'
      AND table_schema LIKE 'org_%'
    ORDER BY table_schema
  LOOP
    idx_name := 'idx_' || replace(s_name, '-', '_') || '_accounting_period';
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.transactions (accounting_period)',
      idx_name, s_name
    );
  END LOOP;
END $$;

-- ── 5. Update provision_org_schema() for future orgs ──────────────────────────
-- DROP first: CREATE OR REPLACE cannot change an existing function's signature/definition
-- when PostgreSQL detects a type conflict. This is safe — we recreate it immediately below.
DROP FUNCTION IF EXISTS platform.provision_org_schema(TEXT);
CREATE OR REPLACE FUNCTION platform.provision_org_schema(p_slug TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT := 'org_' || replace(p_slug, '-', '_');
BEGIN
  -- Create the org's private schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- transactions table (includes accounting_period + entered_by)
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.transactions (
      id                SERIAL PRIMARY KEY,
      date              DATE          NOT NULL,
      accounting_period CHAR(7),
      category          VARCHAR(20)   NOT NULL CHECK (category IN ('Income', 'Expense', 'Transfer')),
      subcategory       VARCHAR(100),
      sender            VARCHAR(255),
      receiver          VARCHAR(255),
      custodian         VARCHAR(255),
      counterparty      VARCHAR(255),
      remarks           TEXT,
      amount            DECIMAL(15, 2) NOT NULL,
      created_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      modifieddate      TIMESTAMP,
      isdeleted         CHAR(1)       DEFAULT 'N' CHECK (isdeleted IN ('Y', 'N')),
      entered_by        VARCHAR(255)
    )
  $sql$, schema_name);

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_date ON %I.transactions(date)',
    replace(schema_name, '-', '_'), schema_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_isdeleted ON %I.transactions(isdeleted)',
    replace(schema_name, '-', '_'), schema_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_accounting_period ON %I.transactions(accounting_period)',
    replace(schema_name, '-', '_'), schema_name
  );

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

-- ── Verification ──────────────────────────────────────────────────────────────
SELECT table_schema, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name = 'accounting_period'
ORDER BY table_schema;

-- Spot-check backfill (should return 0 for all schemas if backfill ran)
SELECT 'Rows missing accounting_period' AS check_name,
       COUNT(*)                         AS count
FROM org_mqlc.transactions
WHERE accounting_period IS NULL;
