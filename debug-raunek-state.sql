-- ============================================
-- DEBUG SCRIPT FOR raunek@cloudsteer.com
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Find user ID and basic info
SELECT
  '=== USER INFO ===' as section,
  id as user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'raunek@cloudsteer.com';

-- 2. Check partnership membership
SELECT
  '=== PARTNERSHIP MEMBERSHIP ===' as section,
  pm.user_id,
  pm.partnership_id,
  pm.role,
  pm.survey_reviewed,
  pm.survey_reviewed_at,
  pm.joined_at
FROM partnership_members pm
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'raunek@cloudsteer.com';

-- 3. Check partnership-based survey
SELECT
  '=== PARTNERSHIP SURVEY ===' as section,
  usr.id as survey_id,
  usr.partnership_id,
  usr.user_id,
  usr.completion_pct,
  usr.current_step,
  usr.completed_sections,
  usr.created_at,
  usr.updated_at
FROM user_survey_responses usr
WHERE usr.partnership_id IN (
  SELECT pm.partnership_id
  FROM partnership_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE u.email = 'raunek@cloudsteer.com'
);

-- 4. Check for user-based survey (SHOULD NOT EXIST)
SELECT
  '=== USER-BASED SURVEY (SHOULD BE EMPTY) ===' as section,
  usr.id as survey_id,
  usr.partnership_id,
  usr.user_id,
  usr.completion_pct
FROM user_survey_responses usr
WHERE usr.user_id IN (
  SELECT id FROM auth.users WHERE email = 'raunek@cloudsteer.com'
);

-- 5. Check partnership details
SELECT
  '=== PARTNERSHIP DETAILS ===' as section,
  p.id as partnership_id,
  p.tier,
  p.owner_id,
  p.created_at,
  (SELECT COUNT(*) FROM partnership_members WHERE partnership_id = p.id) as member_count
FROM partnerships p
WHERE p.id IN (
  SELECT pm.partnership_id
  FROM partnership_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE u.email = 'raunek@cloudsteer.com'
);

-- 6. Diagnostic summary
SELECT
  '=== DIAGNOSTIC SUMMARY ===' as section,
  CASE
    WHEN pm.partnership_id IS NULL THEN '❌ NO PARTNERSHIP FOUND'
    WHEN usr.completion_pct IS NULL THEN '❌ NO SURVEY DATA'
    WHEN usr.completion_pct < 100 THEN '⚠️  SURVEY INCOMPLETE (' || usr.completion_pct || '%)'
    WHEN NOT pm.survey_reviewed THEN '⚠️  SURVEY NOT REVIEWED'
    ELSE '✅ ALL CHECKS PASSED'
  END as status,
  CASE
    WHEN pm.partnership_id IS NULL THEN 'Create partnership and membership'
    WHEN usr.completion_pct IS NULL THEN 'Create partnership survey'
    WHEN usr.completion_pct < 100 THEN 'Complete survey or set to 100%'
    WHEN NOT pm.survey_reviewed THEN 'Mark survey as reviewed'
    ELSE 'Dashboard should be accessible'
  END as recommended_action
FROM auth.users u
LEFT JOIN partnership_members pm ON pm.user_id = u.id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = pm.partnership_id
WHERE u.email = 'raunek@cloudsteer.com';

-- ============================================
-- QUICK FIXES (Run these if needed based on diagnostic)
-- ============================================

-- FIX A: Mark survey as reviewed
/*
UPDATE partnership_members
SET
  survey_reviewed = true,
  survey_reviewed_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'raunek@cloudsteer.com'
);
*/

-- FIX B: Set survey to 100% complete
/*
UPDATE user_survey_responses
SET
  completion_pct = 100,
  updated_at = NOW()
WHERE partnership_id = (
  SELECT partnership_id
  FROM partnership_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE u.email = 'raunek@cloudsteer.com'
);
*/

-- FIX C: Delete user-based survey if exists
/*
DELETE FROM user_survey_responses
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'raunek@cloudsteer.com'
)
AND partnership_id IS NULL;
*/

-- FIX D: Create partnership + membership (if missing)
/*
-- Step 1: Create partnership
INSERT INTO partnerships (owner_id, tier, created_at, updated_at)
SELECT
  id,
  'free',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'raunek@cloudsteer.com'
RETURNING id;

-- Step 2: Create membership (replace <PARTNERSHIP_ID> with ID from above)
INSERT INTO partnership_members (
  user_id,
  partnership_id,
  role,
  survey_reviewed,
  survey_reviewed_at,
  joined_at
)
SELECT
  id,
  '<PARTNERSHIP_ID>',  -- REPLACE THIS
  'owner',
  true,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'raunek@cloudsteer.com';

-- Step 3: Create partnership survey (replace <PARTNERSHIP_ID>)
INSERT INTO user_survey_responses (
  partnership_id,
  user_id,
  completion_pct,
  current_step,
  completed_sections,
  answers_json,
  created_at,
  updated_at
)
VALUES (
  '<PARTNERSHIP_ID>',  -- REPLACE THIS
  NULL,
  100,
  0,
  ARRAY[]::text[],
  '{}'::jsonb,
  NOW(),
  NOW()
);
*/

-- ============================================
-- VERIFICATION QUERY (Run after fixes)
-- ============================================
/*
SELECT
  'Verification' as check_type,
  pm.partnership_id IS NOT NULL as has_partnership,
  pm.survey_reviewed as survey_reviewed,
  usr.completion_pct as completion_pct,
  CASE
    WHEN pm.partnership_id IS NOT NULL
      AND pm.survey_reviewed = true
      AND usr.completion_pct = 100
    THEN '✅ SHOULD WORK'
    ELSE '❌ STILL BROKEN'
  END as dashboard_access
FROM auth.users u
LEFT JOIN partnership_members pm ON pm.user_id = u.id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = pm.partnership_id
WHERE u.email = 'raunek@cloudsteer.com';
*/
