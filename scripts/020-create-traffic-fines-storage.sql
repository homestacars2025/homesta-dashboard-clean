-- Create storage bucket for traffic fines if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('traffic-fines', 'traffic-fines', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads to traffic-fines" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from traffic-fines" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to traffic-fines" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from traffic-fines" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to traffic-fines"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'traffic-fines');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads from traffic-fines"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'traffic-fines');

-- Allow authenticated users to update files
CREATE POLICY "Allow authenticated updates to traffic-fines"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'traffic-fines');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes from traffic-fines"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'traffic-fines');

-- Also allow public read access since bucket is public
CREATE POLICY "Allow public reads from traffic-fines"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'traffic-fines');
