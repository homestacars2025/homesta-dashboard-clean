-- Create partners table for broker companies
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  country TEXT,
  api_access BOOLEAN DEFAULT false
);

-- Create index on profile_id for faster lookups
CREATE INDEX IF NOT EXISTS partners_profile_id_idx ON partners(profile_id);

-- Add comment
COMMENT ON TABLE partners IS 'Broker companies with user accounts (not standalone)';
