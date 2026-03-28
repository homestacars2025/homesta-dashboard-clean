-- Create demo admin user for login
-- This script creates a demo admin account that can be used for testing

-- Note: In Supabase, you typically create users through the auth.users table
-- However, direct SQL insertion into auth.users is not recommended in production
-- This is a demo setup script only

-- First, ensure the profile exists
-- We'll use a known UUID for the demo admin
DO $$
DECLARE
  demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
  demo_email text := 'admin@homesta.com';
BEGIN
  -- Check if profile already exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = demo_user_id) THEN
    -- Insert demo admin profile
    INSERT INTO profiles (
      id,
      email,
      full_name,
      role,
      status,
      phone,
      created_at,
      updated_at
    ) VALUES (
      demo_user_id,
      demo_email,
      'Demo Administrator',
      'admin',
      'active',
      '+1234567890',
      now(),
      now()
    );
    
    RAISE NOTICE 'Demo admin profile created';
  ELSE
    RAISE NOTICE 'Demo admin profile already exists';
  END IF;
END $$;

-- Instructions for creating the auth user:
-- Since direct SQL insertion into auth.users is complex and not recommended,
-- you should create this user through the Supabase Dashboard or using the Supabase client:
-- 
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User"
-- 3. Email: admin@homesta.com
-- 4. Password: admin123 (or any password you want)
-- 5. Confirm the email automatically
--
-- OR use this SQL in Supabase SQL Editor if you have the necessary permissions:
--
-- SELECT extensions.create_user(
--   email => 'admin@homesta.com',
--   password => 'admin123',
--   email_confirm => true
-- );
