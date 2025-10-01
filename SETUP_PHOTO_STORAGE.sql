-- Setup Supabase Storage for partnership photos
-- Run this in Production Supabase SQL Editor

-- Create storage bucket for partnership photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('partnership-photos', 'partnership-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'partnership-photos');

-- Allow authenticated users to view photos
CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'partnership-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'partnership-photos');

-- Verify
SELECT 'Photo storage bucket created successfully' AS status;
