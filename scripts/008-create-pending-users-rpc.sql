-- Create RPC function to get auth users without profiles (pending users)
-- This requires service role access, so it needs to be a security definer function

CREATE OR REPLACE FUNCTION get_pending_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function requires service role to query auth.users
  -- In production, you would implement proper access control
  RETURN QUERY
  SELECT 
    au.id,
    au.email::text,
    au.created_at
  FROM auth.users au
  LEFT JOIN profiles p ON au.id = p.id
  WHERE p.id IS NULL
  ORDER BY au.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pending_users() TO authenticated;

COMMENT ON FUNCTION get_pending_users() IS 'Returns auth users who do not have a profile record (pending approval)';
