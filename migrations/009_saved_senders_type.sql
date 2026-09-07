-- ============================================================
-- Migration 009: Add sender_type column to saved_senders
-- Enables role-based sender categorisation (e.g. 'staff' for salaries)
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
-- ============================================================

-- 1. Add sender_type to public.saved_senders if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'saved_senders'
  ) THEN
    ALTER TABLE public.saved_senders 
      ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50) DEFAULT 'general';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'trial_saved_senders'
  ) THEN
    ALTER TABLE public.trial_saved_senders 
      ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50) DEFAULT 'general';
  END IF;
END;
$$;

-- 2. Add sender_type to all existing tenant org schemas
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT table_schema
    FROM information_schema.tables
    WHERE table_name = 'saved_senders'
      AND table_schema NOT IN ('public', 'information_schema', 'pg_catalog')
  ) LOOP
    EXECUTE format(
      'ALTER TABLE %I.saved_senders ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50) DEFAULT ''general''',
      r.table_schema
    );
  END LOOP;
END;
$$;

-- 3. Update platform.provision_org_schema to include sender_type for future schemas
CREATE OR REPLACE FUNCTION platform.provision_org_schema(p_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schema_name text;
BEGIN
  schema_name := 'org_' || replace(p_slug, '-', '_');

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

  -- saved_senders table (with sender_type)
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.saved_senders (
      id          SERIAL PRIMARY KEY,
      sender      VARCHAR(255) UNIQUE NOT NULL,
      sender_type VARCHAR(50) DEFAULT 'general',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  $sql$, schema_name);

  -- Mark schema as provisioned in org registry
  UPDATE platform.orgs SET schema_provisioned = TRUE WHERE slug = p_slug;

  RETURN schema_name;
END;
$$;
