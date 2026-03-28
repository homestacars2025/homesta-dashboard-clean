-- Add missing columns to customers table to support standalone customer data
-- This is a safer migration that adds columns without dropping the table

-- Add customer data columns if they don't exist
DO $$ 
BEGIN
  -- Add first_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='first_name') THEN
    ALTER TABLE customers ADD COLUMN first_name text NOT NULL DEFAULT '';
  END IF;

  -- Add last_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='last_name') THEN
    ALTER TABLE customers ADD COLUMN last_name text NOT NULL DEFAULT '';
  END IF;

  -- Add phone column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='phone') THEN
    ALTER TABLE customers ADD COLUMN phone text;
  END IF;

  -- Add identity_number column (unique ID number like passport or national ID)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='identity_number') THEN
    ALTER TABLE customers ADD COLUMN identity_number text UNIQUE;
  END IF;

  -- Add id_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='id_type') THEN
    ALTER TABLE customers ADD COLUMN id_type text;
  END IF;

  -- Add nationality column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='nationality') THEN
    ALTER TABLE customers ADD COLUMN nationality text;
  END IF;

  -- Add driving_license_number column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='driving_license_number') THEN
    ALTER TABLE customers ADD COLUMN driving_license_number text;
  END IF;

  -- Add address column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='customers' AND column_name='address') THEN
    ALTER TABLE customers ADD COLUMN address text;
  END IF;
END $$;

-- Now remove the DEFAULT '' constraint from first_name and last_name
ALTER TABLE customers ALTER COLUMN first_name DROP DEFAULT;
ALTER TABLE customers ALTER COLUMN last_name DROP DEFAULT;

-- Create index on identity_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_identity_number ON customers(identity_number);

-- Update RLS policies for customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert customers
DROP POLICY IF EXISTS "Allow authenticated users to insert customers" ON customers;
CREATE POLICY "Allow authenticated users to insert customers"
ON customers FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to view customers
DROP POLICY IF EXISTS "Allow authenticated users to view customers" ON customers;
CREATE POLICY "Allow authenticated users to view customers"
ON customers FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to update customers
DROP POLICY IF EXISTS "Allow authenticated users to update customers" ON customers;
CREATE POLICY "Allow authenticated users to update customers"
ON customers FOR UPDATE
TO authenticated
USING (true);
