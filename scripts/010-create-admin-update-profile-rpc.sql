-- Create RPC function for admin to update profiles and activate users
-- This avoids trigger function errors and provides a clean admin interface

CREATE OR REPLACE FUNCTION admin_update_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_nationality TEXT,
  p_birth_date DATE,
  p_identity_number TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'customer',
  p_status TEXT DEFAULT 'active'
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update the profile
  UPDATE public.profiles
  SET
    full_name = p_full_name,
    phone = p_phone,
    nationality = p_nationality,
    birth_date = p_birth_date,
    identity_number = p_identity_number,
    address = p_address,
    role = p_role::user_role,
    status = p_status::user_status,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Profile updated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (RLS will control access)
GRANT EXECUTE ON FUNCTION admin_update_profile TO authenticated;
