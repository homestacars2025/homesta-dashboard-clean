-- Create RPC function to sync profile role to appropriate tables
CREATE OR REPLACE FUNCTION sync_profile_role(
  p_profile_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove from all role-specific tables first
  DELETE FROM team_members WHERE profile_id = p_profile_id;
  DELETE FROM investors WHERE profile_id = p_profile_id;
  DELETE FROM customers WHERE profile_id = p_profile_id;

  -- Add to appropriate table based on role
  IF p_role = 'admin' OR p_role = 'staff' THEN
    INSERT INTO team_members (profile_id, position, is_active)
    VALUES (p_profile_id, NULL, true)
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF p_role = 'investor' THEN
    INSERT INTO investors (profile_id, company_name, total_investment, is_active)
    VALUES (p_profile_id, NULL, NULL, true)
    ON CONFLICT (profile_id) DO NOTHING;
  ELSIF p_role = 'customer' THEN
    INSERT INTO customers (profile_id, notes)
    VALUES (p_profile_id, NULL)
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_profile_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_profile_role(uuid, text) TO service_role;
