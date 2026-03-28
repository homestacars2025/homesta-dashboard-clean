-- Update profiles table to add new fields for user management
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active')),
ADD COLUMN IF NOT EXISTS investor_id BIGINT REFERENCES investors(id);

-- Update team_members table to add new fields
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('ADMIN', 'STAFF', 'INVESTOR')),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_investor_id ON profiles(investor_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Update existing team_members records to set is_active = true if NULL
UPDATE team_members SET is_active = true WHERE is_active IS NULL;

-- Add comment to tables
COMMENT ON TABLE profiles IS 'User profiles linked to auth.users, includes phone, status, and investor association';
COMMENT ON TABLE team_members IS 'Team members with roles (ADMIN, STAFF, INVESTOR) and active status';
