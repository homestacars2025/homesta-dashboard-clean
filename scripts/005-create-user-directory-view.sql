-- Drop existing tables/view if they exist and recreate with correct schema
-- This migration creates the user directory view as specified

-- First, update profiles table to add role column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'customer';
    ALTER TABLE profiles ADD COLUMN nationality text;
    ALTER TABLE profiles ADD COLUMN birth_date date;
    ALTER TABLE profiles ADD COLUMN identity_number text;
    ALTER TABLE profiles ADD COLUMN address text;
    ALTER TABLE profiles ALTER COLUMN status TYPE text;
    ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'active';
  END IF;
END $$;

-- Create team_members table with profile_id reference
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  position text,
  is_active boolean DEFAULT true
);

-- Recreate investors table with profile_id reference
DROP TABLE IF EXISTS investors CASCADE;
CREATE TABLE investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name text,
  total_investment numeric,
  is_active boolean DEFAULT true
);

-- Create customers table with profile_id reference
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes text
);

-- Update cars table to add investor_id referencing investors
ALTER TABLE cars DROP COLUMN IF EXISTS owner_id CASCADE;
ALTER TABLE cars ADD COLUMN investor_id uuid REFERENCES investors(id) ON DELETE SET NULL;

-- Create or replace the user_directory VIEW
CREATE OR REPLACE VIEW user_directory AS
SELECT
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.role,
  p.status,
  p.created_at,
  p.nationality,
  p.birth_date,
  p.identity_number,
  p.address,
  -- Team member fields
  tm.id AS team_member_id,
  tm.position,
  tm.is_active AS team_is_active,
  -- Investor fields
  inv.id AS investor_id,
  inv.company_name,
  inv.total_investment,
  inv.is_active AS investor_is_active,
  -- Customer fields
  c.id AS customer_id,
  c.notes
FROM profiles p
LEFT JOIN team_members tm ON p.id = tm.profile_id
LEFT JOIN investors inv ON p.id = inv.profile_id
LEFT JOIN customers c ON p.id = c.profile_id;

-- Grant permissions
GRANT SELECT ON user_directory TO authenticated;
GRANT ALL ON team_members TO authenticated;
GRANT ALL ON investors TO authenticated;
GRANT ALL ON customers TO authenticated;
