-- ============================================================
-- Migration: Add entered_by column to all transaction tables
-- KhataCloud Multi-tenant SaaS Schema Migration
--
-- SAFE TO RUN: Automatically discovers all org schemas (org_*)
-- and updates public.transactions, trial_transactions, and all org schemas.
-- Also updates platform.provision_org_schema for future org creation.
-- ============================================================

DO $$
DECLARE
  s_name TEXT;
BEGIN
  -- 1. Public legacy transactions table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255);
  END IF;

  -- 2. Trial transactions table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trial_transactions') THEN
    ALTER TABLE public.trial_transactions ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255);
  END IF;

  -- 3. Dynamically alter all multi-tenant org schemas (e.g. org_mqlc, org_demo, etc.)
  FOR s_name IN 
    SELECT table_schema 
    FROM information_schema.tables 
    WHERE table_name = 'transactions' 
      AND table_schema LIKE 'org_%'
  LOOP
    EXECUTE format('ALTER TABLE %I.transactions ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255)', s_name);
    RAISE NOTICE 'Added entered_by column to schema %', s_name;
  END LOOP;
END $$;

-- 4. Update stored procedure for auto-provisioning new org schemas
CREATE OR REPLACE FUNCTION platform.provision_org_schema(p_slug TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT := 'org_' || replace(p_slug, '-', '_');
BEGIN
  -- Create the org's private schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- transactions table (including entered_by)
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
      isdeleted     CHAR(1)      DEFAULT 'N' CHECK (isdeleted IN ('Y', 'N')),
      entered_by    VARCHAR(255)
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

-- Verification query
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'entered_by';
