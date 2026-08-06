-- ============================================================
-- Script: Copy Legacy Data to an Org Schema (Non-Regressive)
-- KhataCloud Multi-Tenant Migration Utility
--
-- HOW IT WORKS:
--   1. Defines a function `platform.copy_legacy_data_to_org(p_org_slug)`
--   2. Copies missing transactions from `public.transactions` → `org_{slug}.transactions`
--   3. Copies missing entities from `public.entities` → `org_{slug}.entities`
--   4. Copies missing senders from `public.saved_senders` → `org_{slug}.saved_senders`
--   5. Safely aligns primary key sequences (setval) to prevent future PK conflicts
--
-- NON-REGRESSIVE GUARANTEES:
--   - Uses NOT EXISTS check — existing org entries are NEVER duplicated or overwritten
--   - Auto-handles missing columns (entered_by)
--   - Preserves exact timestamps, amounts, remarks, custodians, counterparties
--
-- HOW TO RUN:
--   1. Open Neon Console → SQL Editor
--   2. Paste and run this script
--   3. Call: SELECT platform.copy_legacy_data_to_org('your-org-slug');
--      (e.g., SELECT platform.copy_legacy_data_to_org('mqlc');)
-- ============================================================

CREATE OR REPLACE FUNCTION platform.copy_legacy_data_to_org(p_org_slug TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_schema TEXT := 'org_' || replace(p_org_slug, '-', '_');
  v_tx_count INT := 0;
  v_entity_count INT := 0;
  v_sender_count INT := 0;
BEGIN
  -- 1. Ensure target schema and tables exist
  PERFORM platform.provision_org_schema(p_org_slug);

  -- Ensure entered_by column exists on both target and source tables if missing
  EXECUTE format('ALTER TABLE %I.transactions ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255)', v_schema);
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255);
  END IF;

  -- 2. Copy missing transactions from public.transactions to target org schema
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    EXECUTE format($sql$
      WITH inserted AS (
        INSERT INTO %I.transactions (
          date, category, subcategory, sender, receiver, custodian, counterparty,
          remarks, amount, created_at, modifieddate, isdeleted, entered_by
        )
        SELECT 
          t.date, t.category, t.subcategory, t.sender, t.receiver, 
          COALESCE(t.custodian, t.receiver) AS custodian,
          COALESCE(t.counterparty, t.sender) AS counterparty,
          t.remarks, t.amount, t.created_at, t.modifieddate, 
          COALESCE(t.isdeleted, 'N') AS isdeleted,
          t.entered_by
        FROM public.transactions t
        WHERE NOT EXISTS (
          SELECT 1 FROM %I.transactions existing
          WHERE existing.date = t.date
            AND existing.category = t.category
            AND COALESCE(existing.subcategory, '') = COALESCE(t.subcategory, '')
            AND existing.custodian = COALESCE(t.custodian, t.receiver)
            AND existing.counterparty = COALESCE(t.counterparty, t.sender)
            AND existing.amount = t.amount
            AND COALESCE(existing.remarks, '') = COALESCE(t.remarks, '')
            AND existing.created_at = t.created_at
        )
        RETURNING id
      )
      SELECT COUNT(*) FROM inserted;
    $sql$, v_schema, v_schema) INTO v_tx_count;

    -- Reset transactions primary key sequence to MAX(id) + 1
    EXECUTE format($sql$
      SELECT setval(
        pg_get_serial_sequence('%I.transactions', 'id'),
        COALESCE((SELECT MAX(id) FROM %I.transactions), 1)
      );
    $sql$, v_schema, v_schema);
  END IF;

  -- 3. Copy missing entities from public.entities
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entities') THEN
    EXECUTE format($sql$
      WITH inserted AS (
        INSERT INTO %I.entities (
          entity_name, entity_type, isdeleted, modifieddate, istrial, created_at
        )
        SELECT 
          e.entity_name, e.entity_type, COALESCE(e.isdeleted, 'N'), e.modifieddate, 
          COALESCE(e.istrial, 'N'), e.created_at
        FROM public.entities e
        WHERE COALESCE(e.istrial, 'N') = 'N'
          AND NOT EXISTS (
            SELECT 1 FROM %I.entities existing
            WHERE LOWER(existing.entity_name) = LOWER(e.entity_name)
          )
        RETURNING id
      )
      SELECT COUNT(*) FROM inserted;
    $sql$, v_schema, v_schema) INTO v_entity_count;

    -- Reset entities primary key sequence
    EXECUTE format($sql$
      SELECT setval(
        pg_get_serial_sequence('%I.entities', 'id'),
        COALESCE((SELECT MAX(id) FROM %I.entities), 1)
      );
    $sql$, v_schema, v_schema);
  END IF;

  -- 4. Copy missing saved_senders from public.saved_senders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_senders') THEN
    EXECUTE format($sql$
      WITH inserted AS (
        INSERT INTO %I.saved_senders (sender, created_at)
        SELECT s.sender, s.created_at
        FROM public.saved_senders s
        WHERE NOT EXISTS (
          SELECT 1 FROM %I.saved_senders existing
          WHERE LOWER(existing.sender) = LOWER(s.sender)
        )
        RETURNING id
      )
      SELECT COUNT(*) FROM inserted;
    $sql$, v_schema, v_schema) INTO v_sender_count;

    -- Reset saved_senders primary key sequence
    EXECUTE format($sql$
      SELECT setval(
        pg_get_serial_sequence('%I.saved_senders', 'id'),
        COALESCE((SELECT MAX(id) FROM %I.saved_senders), 1)
      );
    $sql$, v_schema, v_schema);
  END IF;

  RETURN format('Schema %s synced: %s transactions, %s entities, %s saved senders copied.', 
                v_schema, v_tx_count, v_entity_count, v_sender_count);
END;
$$;

-- Example execution (replace 'mqlc' with your target org slug if different):
-- SELECT platform.copy_legacy_data_to_org('mqlc');
