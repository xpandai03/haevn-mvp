-- Check if user_survey_responses table exists and has correct structure

-- 1. Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'user_survey_responses'
) AS table_exists;

-- 2. Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_survey_responses'
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_survey_responses';

-- 4. Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_survey_responses';

-- 5. Try a test insert (as authenticated user, will fail if RLS blocks)
-- This is just to see what error we get
SELECT 'RLS check complete' AS status;
