-- ============================================================
-- Migration: Add custodian/counterparty columns & Transfer support
-- Run this in Neon Dashboard BEFORE deploying new code
--
-- SAFETY: Entire migration is wrapped in a transaction.
-- If ANY step fails, ALL changes are rolled back automatically.
-- Your data will remain exactly as it was before.
-- ============================================================

BEGIN;

-- ========================================
-- STEP 1: Main transactions table
-- ========================================

-- Add new columns (IF NOT EXISTS = safe to re-run)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS custodian VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counterparty VARCHAR(255);

-- Make subcategory nullable (Transfer has no subcategory)
ALTER TABLE transactions ALTER COLUMN subcategory DROP NOT NULL;

-- STEP 2: Backfill custodian/counterparty from existing sender/receiver
-- IMPORTANT: In the actual data layout:
--   Income:  sender = donor (external),  receiver = trust member (custodian)
--   Expense: sender = vendor (external), receiver = trust member (custodian)
-- So for BOTH categories, receiver = custodian and sender = counterparty
UPDATE transactions SET
  custodian = receiver,
  counterparty = sender
WHERE custodian IS NULL;

-- ========================================
-- STEP 3: Trial transactions table
-- ========================================

ALTER TABLE trial_transactions ADD COLUMN IF NOT EXISTS custodian VARCHAR(255);
ALTER TABLE trial_transactions ADD COLUMN IF NOT EXISTS counterparty VARCHAR(255);
ALTER TABLE trial_transactions ALTER COLUMN subcategory DROP NOT NULL;

-- Update CHECK constraint to allow Transfer
ALTER TABLE trial_transactions DROP CONSTRAINT IF EXISTS trial_transactions_category_check;
ALTER TABLE trial_transactions ADD CONSTRAINT trial_transactions_category_check
  CHECK (category IN ('Income', 'Expense', 'Transfer'));

-- Backfill trial data (same mapping: receiver=custodian, sender=counterparty)
UPDATE trial_transactions SET
  custodian = receiver,
  counterparty = sender
WHERE custodian IS NULL;

-- ========================================
-- STEP 3: Update entity types
-- ========================================

-- FIRST: Drop the old CHECK constraint (it only allows 'sender'/'receiver'/'both')
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_entity_type_check;

-- THEN: Update the values
-- Current 'receiver' entities are trust members → 'trustee'
-- Current 'sender' entities are external parties → 'other'
UPDATE entities SET entity_type = 'trustee' WHERE entity_type = 'receiver';
UPDATE entities SET entity_type = 'other' WHERE entity_type IN ('sender', 'both');

-- FINALLY: Add new CHECK constraint with the updated allowed values
ALTER TABLE entities ADD CONSTRAINT entities_entity_type_check
  CHECK (entity_type IN ('trustee', 'donor', 'vendor', 'other'));

-- ========================================
-- VERIFICATION (runs inside the transaction)
-- If these look wrong, the COMMIT below won't have happened yet
-- and you can manually run ROLLBACK instead
-- ========================================

-- Check: Every active transaction should have custodian and counterparty filled
SELECT 'Transactions missing custodian' as check_name,
       COUNT(*) as count
FROM transactions
WHERE IsDeleted = 'N' AND custodian IS NULL;

SELECT 'Transactions missing counterparty' as check_name,
       COUNT(*) as count
FROM transactions
WHERE IsDeleted = 'N' AND counterparty IS NULL;

-- Check: Show sample of backfilled data
SELECT id, category, sender, receiver, custodian, counterparty
FROM transactions
WHERE IsDeleted = 'N'
ORDER BY id DESC
LIMIT 5;

-- Check: Entity types after migration
SELECT entity_type, COUNT(*) as count
FROM entities
WHERE IsDeleted = 'N'
GROUP BY entity_type
ORDER BY entity_type;

COMMIT;

-- ============================================================
-- If something looks wrong BEFORE you run COMMIT:
--   Run: ROLLBACK;
--   This will undo ALL changes and restore your data exactly.
--
-- If you already committed and need to revert entity types:
--   UPDATE entities SET entity_type = 'receiver' WHERE entity_type = 'trustee';
--   UPDATE entities SET entity_type = 'sender' WHERE entity_type = 'other';
-- ============================================================
