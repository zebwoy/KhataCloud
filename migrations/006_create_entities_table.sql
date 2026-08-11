-- Create entities table to store senders, receivers, and other entities
-- This table will be used to dynamically populate form controls and filters
CREATE TABLE IF NOT EXISTS entities (
  id SERIAL PRIMARY KEY,
  entity_name VARCHAR(255) NOT NULL UNIQUE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('sender', 'receiver', 'both')),
  IsDeleted CHAR(1) DEFAULT 'N' CHECK (IsDeleted IN ('Y', 'N')),
  ModifiedDate TIMESTAMP,
  IsTrial CHAR(1) DEFAULT 'N' CHECK (IsTrial IN ('Y', 'N')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(entity_name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_trial ON entities(IsTrial);
CREATE INDEX IF NOT EXISTS idx_entities_deleted ON entities(IsDeleted);

-- Insert Receivers (for receiving donations) - Trial Mode
INSERT INTO entities (entity_name, entity_type, IsTrial) VALUES
  ('Trust Bank account', 'receiver', 'Y'),
  ('Trust Member 1', 'receiver', 'Y'),
  ('Trust Member 2', 'receiver', 'Y'),
  ('Trust President', 'receiver', 'Y'),
  ('Trust Vice-President', 'receiver', 'Y'),
  ('Trust Accountant', 'receiver', 'Y')
ON CONFLICT (entity_name) DO NOTHING;

-- Insert Senders (general entities that can send money/donations or receive payments) - Trial Mode
-- Note: These can be used as senders for Income or receivers for Expense transactions
INSERT INTO entities (entity_name, entity_type, IsTrial) VALUES
  ('Donor 1', 'sender', 'Y'),
  ('Donor 2', 'sender', 'Y'),
  ('XYZ NGO', 'sender', 'Y'),
  ('ABC NGO', 'sender', 'Y'),
  ('Hardware shop', 'sender', 'Y'),
  ('Plumbing Shop', 'sender', 'Y'),
  ('Construction Materials', 'sender', 'Y'),
  ('Mason Labour Charge', 'sender', 'Y'),
  ('Plumber Labour Charge', 'sender', 'Y'),
  ('Paint Material', 'sender', 'Y'),
  ('Painter Labour charge', 'sender', 'Y')
ON CONFLICT (entity_name) DO NOTHING;
