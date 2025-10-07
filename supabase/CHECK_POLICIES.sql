-- Quick check to see current policies

-- Check partnership_members policies
SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual::text, 100) as qual_preview
FROM pg_policies
WHERE tablename = 'partnership_members'
ORDER BY policyname;

-- Check partnership_photos policies
SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual::text, 100) as qual_preview
FROM pg_policies
WHERE tablename = 'partnership_photos'
ORDER BY policyname;
