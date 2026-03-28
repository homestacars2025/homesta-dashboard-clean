-- Fix trigger function error on profiles update
-- The issue is that trigger functions can only be called by triggers, not directly

-- Ensure handle_new_user is ONLY called by the auth.users trigger
-- and doesn't interfere with direct updates to profiles

-- Drop any existing triggers on profiles table that might call trigger functions
DROP TRIGGER IF EXISTS on_profile_update ON profiles;
DROP TRIGGER IF EXISTS on_profile_insert ON profiles;

-- Ensure the handle_new_user function is only attached to auth.users
-- (This was already done in 009, but we're being explicit)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify there are no RLS policies that call trigger functions
-- (RLS policies should only use SELECT, not call functions marked as triggers)

-- Grant necessary permissions for direct updates
GRANT UPDATE ON profiles TO authenticated;
GRANT UPDATE ON profiles TO service_role;
