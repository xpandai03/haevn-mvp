-- Fix Storage Buckets and Policies for Photo Upload
-- This creates the correct buckets and sets up RLS policies

-- ============================================
-- PART 1: Create Storage Buckets
-- ============================================

-- Create public-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-photos',
  'public-photos',
  true,  -- Public bucket
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Create private-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-photos',
  'private-photos',
  false,  -- Private bucket
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- ============================================
-- PART 2: Drop Existing Storage Policies
-- ============================================

-- Drop all existing policies on storage.objects for our buckets
DROP POLICY IF EXISTS "Public photos - authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Public photos - public view" ON storage.objects;
DROP POLICY IF EXISTS "Public photos - owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Public photos - owner update" ON storage.objects;

DROP POLICY IF EXISTS "Private photos - authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Private photos - member view" ON storage.objects;
DROP POLICY IF EXISTS "Private photos - owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Private photos - owner update" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;

-- ============================================
-- PART 3: Create Storage Policies for public-photos
-- ============================================

-- Allow authenticated users to upload to public-photos bucket
CREATE POLICY "Public photos - authenticated upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public-photos'
);

-- Allow anyone to view public photos
CREATE POLICY "Public photos - public view"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public-photos');

-- Allow users to delete their partnership's photos
CREATE POLICY "Public photos - owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'public-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM partnerships p
    INNER JOIN partnership_members pm ON pm.partnership_id = p.id
    WHERE pm.user_id = auth.uid()
  )
);

-- Allow users to update their partnership's photos
CREATE POLICY "Public photos - owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM partnerships p
    INNER JOIN partnership_members pm ON pm.partnership_id = p.id
    WHERE pm.user_id = auth.uid()
  )
);

-- ============================================
-- PART 4: Create Storage Policies for private-photos
-- ============================================

-- Allow authenticated users to upload to private-photos bucket
CREATE POLICY "Private photos - authenticated upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'private-photos'
);

-- Allow partnership members to view private photos
CREATE POLICY "Private photos - member view"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'private-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM partnerships p
    INNER JOIN partnership_members pm ON pm.partnership_id = p.id
    WHERE pm.user_id = auth.uid()
  )
);

-- Allow users to delete their partnership's private photos
CREATE POLICY "Private photos - owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'private-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM partnerships p
    INNER JOIN partnership_members pm ON pm.partnership_id = p.id
    WHERE pm.user_id = auth.uid()
  )
);

-- Allow users to update their partnership's private photos
CREATE POLICY "Private photos - owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'private-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text
    FROM partnerships p
    INNER JOIN partnership_members pm ON pm.partnership_id = p.id
    WHERE pm.user_id = auth.uid()
  )
);

-- ============================================
-- PART 5: Verify Setup
-- ============================================

-- Check buckets
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('public-photos', 'private-photos');

-- Check policies
SELECT
  policyname,
  cmd,
  qual::text
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%photos%';
