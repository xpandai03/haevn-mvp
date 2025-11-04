-- QUICK TEST SETUP FOR PHASE 1
-- Run these queries in Supabase SQL Editor to prepare for testing
-- Date: November 3, 2025

-- ============================================
-- STEP 1: VERIFY MIGRATIONS RAN SUCCESSFULLY
-- ============================================

-- 1.1 Check columns exist
SELECT
  'user_survey_responses columns' as check_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'user_survey_responses'
  AND column_name IN ('user_id', 'partnership_id');
-- Expected: column_count = 2

SELECT
  'partnership_members survey columns' as check_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'partnership_members'
  AND column_name IN ('survey_reviewed', 'survey_reviewed_at');
-- Expected: column_count = 2

-- 1.2 Check constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'user_survey_responses'::regclass
  AND conname = 'user_survey_responses_ownership_check';
-- Expected: Should return 1 row with CHECK constraint

-- 1.3 Check RLS policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'user_survey_responses'
ORDER BY policyname;
-- Expected: 4 policies (survey_select, insert, update, delete)

-- 1.4 Check trigger function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'auto_mark_owner_survey_reviewed';
-- Expected: Should return 1 row

-- 1.5 Verify backfill results
SELECT
  COUNT(*) as total_surveys,
  COUNT(user_id) as user_based,
  COUNT(partnership_id) as partnership_based,
  COUNT(CASE WHEN user_id IS NOT NULL AND partnership_id IS NOT NULL THEN 1 END) as invalid_both,
  COUNT(CASE WHEN user_id IS NULL AND partnership_id IS NULL THEN 1 END) as invalid_neither
FROM user_survey_responses;
-- Expected: invalid_both = 0, invalid_neither = 0

-- ============================================
-- STEP 2: CREATE TEST INVITE
-- ============================================

-- 2.1 Find an existing owner to create invite from
-- (Replace 'your-email@example.com' with your test account email)
SELECT
  u.id as user_id,
  u.email,
  pm.partnership_id,
  pm.role,
  usr.completion_pct
FROM auth.users u
JOIN partnership_members pm ON pm.user_id = u.id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = pm.partnership_id
WHERE u.email = 'your-email@example.com' -- CHANGE THIS
  AND pm.role = 'owner';

-- 2.2 Create test invite (use IDs from query above)
-- IMPORTANT: Replace the placeholders with actual values from 2.1
INSERT INTO partnership_requests (
  from_user_id,
  to_email,
  partnership_id,
  invite_code,
  status,
  created_at,
  updated_at
) VALUES (
  'USER_ID_FROM_QUERY_ABOVE',        -- Replace this
  'partner-test@example.com',         -- Partner's email (must be NEW email)
  'PARTNERSHIP_ID_FROM_QUERY_ABOVE',  -- Replace this
  'TEST01',                           -- Invite code to use
  'pending',
  NOW(),
  NOW()
) RETURNING *;

-- 2.3 Verify invite created
SELECT
  pr.invite_code,
  pr.to_email,
  pr.status,
  u.email as from_email,
  pr.partnership_id
FROM partnership_requests pr
JOIN auth.users u ON u.id = pr.from_user_id
WHERE pr.invite_code = 'TEST01';

-- ============================================
-- STEP 3: MONITOR TEST USERS
-- ============================================

-- 3.1 Check all partnership members
SELECT
  u.email,
  pm.partnership_id,
  pm.role,
  pm.survey_reviewed,
  pm.survey_reviewed_at,
  pm.joined_at
FROM auth.users u
JOIN partnership_members pm ON pm.user_id = u.id
ORDER BY pm.joined_at DESC
LIMIT 10;

-- 3.2 Check survey status for partnerships
SELECT
  p.id as partnership_id,
  COUNT(pm.user_id) as member_count,
  COUNT(CASE WHEN pm.survey_reviewed THEN 1 END) as reviewed_count,
  usr.completion_pct,
  is_partnership_survey_reviewed(p.id) as fully_reviewed
FROM partnerships p
LEFT JOIN partnership_members pm ON p.id = pm.partnership_id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = p.id
GROUP BY p.id, usr.completion_pct
ORDER BY p.created_at DESC
LIMIT 10;

-- 3.3 Check pending invites
SELECT
  pr.invite_code,
  pr.to_email,
  pr.status,
  u.email as from_email,
  pr.created_at
FROM partnership_requests pr
JOIN auth.users u ON u.id = pr.from_user_id
WHERE pr.status = 'pending'
ORDER BY pr.created_at DESC;

-- ============================================
-- STEP 4: CLEANUP (RUN AFTER TESTING)
-- ============================================

-- WARNING: Only run these if you want to reset test data

-- Delete test invite
-- DELETE FROM partnership_requests WHERE invite_code = 'TEST01';

-- Remove test partner from partnership
-- DELETE FROM partnership_members
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'partner-test@example.com');

-- Delete test user (DANGEROUS - be careful!)
-- DELETE FROM auth.users WHERE email = 'partner-test@example.com';

-- ============================================
-- STEP 5: TROUBLESHOOTING QUERIES
-- ============================================

-- If user can't access dashboard, check this:
SELECT
  u.email,
  pm.partnership_id,
  pm.role,
  pm.survey_reviewed as "Has Reviewed?",
  usr.completion_pct as "Survey %",
  CASE
    WHEN pm.partnership_id IS NULL THEN 'No Partnership'
    WHEN usr.completion_pct < 100 THEN 'Survey Incomplete'
    WHEN NOT pm.survey_reviewed THEN 'Not Reviewed'
    ELSE 'Should Have Access'
  END as access_status
FROM auth.users u
LEFT JOIN partnership_members pm ON pm.user_id = u.id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = pm.partnership_id
WHERE u.email = 'user-email@example.com'; -- Replace with email to check

-- If survey not saving, check partnership exists:
SELECT
  u.email,
  pm.partnership_id,
  pm.role,
  p.owner_id,
  p.created_at
FROM auth.users u
JOIN partnership_members pm ON pm.user_id = u.id
JOIN partnerships p ON p.id = pm.partnership_id
WHERE u.email = 'user-email@example.com'; -- Replace with email to check

-- Check if RLS is blocking access:
SET ROLE authenticated;
SELECT * FROM user_survey_responses LIMIT 1;
-- If this fails, RLS policies might be too restrictive

RESET ROLE;
