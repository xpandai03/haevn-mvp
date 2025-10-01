-- Check RLS policies on partnership_members table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'partnership_members';

-- Also check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'partnership_members';

-- Check the table structure (use information_schema instead of \d)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'partnership_members'
ORDER BY ordinal_position;

-- Try to select as the authenticated user
SELECT * FROM partnership_members
WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;
