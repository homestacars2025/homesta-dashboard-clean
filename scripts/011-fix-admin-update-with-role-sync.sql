-- Drop and recreate admin_update_profile function with role table syncing
DROP FUNCTION IF EXISTS admin_update_profile;

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
  v_old_role TEXT;
  v_new_role TEXT;
BEGIN
  -- Get the current role before updating
  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  v_new_role := p_role;

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
    status = p_status::user_status
  WHERE id = p_user_id;

  -- Handle role table syncing based on new role
  -- If new role is admin or staff, ensure team_members row exists
  IF v_new_role IN ('admin', 'staff') THEN
    INSERT INTO public.team_members (profile_id, position, is_active)
    VALUES (p_user_id, NULL, true)
    ON CONFLICT (profile_id) DO UPDATE SET is_active = true;
  END IF;

  -- If new role is investor, ensure investors row exists
  IF v_new_role = 'investor' THEN
    INSERT INTO public.investors (profile_id, company_name, total_investment, is_active)
    VALUES (p_user_id, NULL, 0, true)
    ON CONFLICT (profile_id) DO UPDATE SET is_active = true;
  END IF;

  -- If new role is customer, no special table needed
  -- (customers table is optional and managed separately)

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Profile updated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_update_profile TO authenticated;
