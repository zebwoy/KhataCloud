-- ============================================================
-- Migration: Add entered_by column to all transaction tables
-- KhataCloud — Tracks which user entered each transaction
--
-- SAFE TO RUN: Uses IF NOT EXISTS / ON CONFLICT DO NOTHING
-- Run in Neon Console → SQL Editor
-- ============================================================

-- ── 1. Public legacy transactions table ──────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255);

-- ── 2. Trial transactions table ──────────────────────────────
ALTER TABLE public.trial_transactions
  ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255);

-- ── 3. All existing org schema transaction tables ─────────────
-- Run for each org slug, e.g. org_mqlc:
-- ALTER TABLE org_mqlc.transactions ADD COLUMN IF NOT EXISTS entered_by VARCHAR(255);

-- ── 4. Update provision_org_schema() to include entered_by ───
-- The function is updated in code (api/transactions.ts CREATE TABLE IF NOT EXISTS).
-- Run platform.provision_org_schema('your-slug') for any NEW orgs after this migration.

-- ── Verification ─────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name = 'entered_by';
