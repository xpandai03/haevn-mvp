-- Debug script to check partnership setup and data

-- 1. Check if user exists and has a profile
SELECT
  u.id as user_id,
  u.email,
  p.full_name,
  p.city,
  p.survey_complete
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'your-test-email@example.com'; -- Replace with your test email

-- 2. Check partnerships table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'partnerships'
  AND table_schema = 'public';

-- 3. Check partnership_members table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'partnership_members'
  AND table_schema = 'public';

-- 4. Check survey_responses table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'survey_responses'
  AND table_schema = 'public';

-- 5. Check RLS policies for partnerships
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
WHERE tablename = 'partnerships';

-- 6. Check RLS policies for partnership_members
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

-- 7. Check RLS policies for survey_responses
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
WHERE tablename = 'survey_responses';

-- 8. Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('partnerships', 'partnership_members', 'survey_responses');

-- 9. Check existing partnerships
SELECT
  p.*,
  COUNT(pm.user_id) as member_count
FROM partnerships p
LEFT JOIN partnership_members pm ON p.id = pm.partnership_id
GROUP BY p.id;

-- 10. Check partnership members
SELECT
  pm.*,
  u.email,
  pr.full_name
FROM partnership_members pm
JOIN auth.users u ON pm.user_id = u.id
LEFT JOIN profiles pr ON u.id = pr.user_id;

-- 11. Check survey responses
SELECT
  sr.*,
  p.display_name as partnership_name
FROM survey_responses sr
LEFT JOIN partnerships p ON sr.partnership_id = p.id;

-- 12. Test INSERT permissions for authenticated user
-- This will help identify permission issues
-- Run this as the authenticated user (not as service role)
/*
INSERT INTO partnerships (owner_id, city, membership_tier)
VALUES (auth.uid(), 'Test City', 'free')
RETURNING *;
*/