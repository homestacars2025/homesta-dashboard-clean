-- Migrate customers table to be standalone (independent from profiles)
-- Customers will store all their data directly without referencing profiles

-- Step 1: Add all customer fields to the customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS identity_number text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS driving_license_number text,
  ADD COLUMN IF NOT EXISTS address text;

-- Step 2: Migrate existing customer data from profiles (if any)
UPDATE customers c
SET
  first_name = COALESCE(SPLIT_PART(p.full_name, ' ', 1), ''),
  last_name = COALESCE(SPLIT_PART(p.full_name, ' ', 2), ''),
  phone = p.phone,
  identity_number = p.identity_number,
  nationality = p.nationality,
  address = p.address
FROM profiles p
WHERE c.profile_id = p.id AND c.profile_id IS NOT NULL;

-- Step 3: Change id from UUID to BIGINT for consistency with other tables
-- (bookings.customer_id is bigint, not uuid)
-- We need to drop and recreate the table to change the primary key type

-- Create a backup of existing customers (if any exist)
CREATE TEMP TABLE customers_backup AS SELECT * FROM customers;

-- Drop the existing customers table
DROP TABLE IF EXISTS customers CASCADE;

-- Create new customers table with BIGINT id (auto-increment)
CREATE TABLE customers (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  identity_number text NOT NULL UNIQUE,
  nationality text,
  id_type text,
  driving_license_number text,
  address text,
  notes text
);

-- Restore data from backup (if any existed)
INSERT INTO customers (first_name, last_name, phone, identity_number, nationality, id_type, address, notes, created_at)
SELECT
  COALESCE(first_name, 'Unknown'),
  COALESCE(last_name, 'Customer'),
  COALESCE(phone, ''),
  COALESCE(identity_number, 'MIGRATED-' || id::text),
  nationality,
  id_type,
  address,
  notes,
  created_at
FROM customers_backup
WHERE first_name IS NOT NULL OR identity_number IS NOT NULL;

-- Drop the backup table
DROP TABLE customers_backup;

-- Grant permissions
GRANT ALL ON customers TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE customers_id_seq TO authenticated;

-- Add index on identity_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_identity_number ON customers(identity_number);

-- Add comment to document the schema
COMMENT ON TABLE customers IS 'Standalone customers table - independent from profiles and auth.users. Used for rental customers only.';
