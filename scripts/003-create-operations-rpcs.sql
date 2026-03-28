-- Create RPC function to restore a soft-deleted operation
CREATE OR REPLACE FUNCTION restore_operation(p_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE operations
  SET deleted_at = NULL
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to permanently delete an operation
CREATE OR REPLACE FUNCTION hard_delete_operation(p_id INTEGER)
RETURNS VOID AS $$
BEGIN
  -- First delete all associated photos from operation_photos table
  DELETE FROM operation_photos WHERE operation_id = p_id;
  
  -- Then delete the operation itself
  DELETE FROM operations WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION restore_operation(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION hard_delete_operation(INTEGER) TO authenticated;
