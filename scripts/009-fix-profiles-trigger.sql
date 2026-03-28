-- Fix the profiles table and create trigger for auto-creating profiles

-- Step 1: Add "pending" to user_status enum if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'pending' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_status')
  ) THEN
    ALTER TYPE user_status ADD VALUE 'pending';
  END IF;
END $$;

-- Step 2: Alter profiles table to make fields nullable
ALTER TABLE profiles 
  ALTER COLUMN full_name DROP NOT NULL,
  ALTER COLUMN role DROP NOT NULL,
  ALTER COLUMN role SET DEFAULT 'customer';

-- Step 3: Create function to auto-create profile on auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, status, role, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    'pending', 
    'customer',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Update existing profiles without email to get it from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
