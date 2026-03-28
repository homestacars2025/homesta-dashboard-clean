-- Remove any UPDATE triggers on profiles table that call trigger functions
-- This fixes the "trigger functions can only be called as triggers" error

-- Drop any existing triggers on profiles table
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
DROP TRIGGER IF EXISTS handle_profile_update ON public.profiles;

-- The handle_new_user trigger function should ONLY be called by auth.users
-- Ensure it exists only on auth.users, not on profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create profile if it doesn't exist
  INSERT INTO public.profiles (id, email, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'customer',
    'pending',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Ensure trigger exists ONLY on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT UPDATE ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO service_role;
