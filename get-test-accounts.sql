-- Run this in Supabase SQL Editor to find test accounts
-- Copy results to use in testing

-- Option 1: Find all test accounts
SELECT
  p.user_id,
  p.email,
  p.full_name,
  p.city,
  p.msa_status,
  usr.completion_pct as survey_completion,
  usr.current_step as survey_step,
  p.created_at,
  CASE
    WHEN usr.completion_pct = 100 THEN 'Complete (use for login loop test)'
    WHEN usr.completion_pct > 0 THEN 'In Progress (use for resume test)'
    ELSE 'Not Started (use for fresh survey test)'
  END as test_use_case
FROM profiles p
LEFT JOIN user_survey_responses usr ON p.user_id = usr.user_id
WHERE
  p.email LIKE '%test%' OR
  p.email LIKE '%tester%' OR
  p.full_name LIKE '%test%' OR
  p.email LIKE '%example%' OR
  p.email LIKE '%demo%'
ORDER BY p.created_at DESC
LIMIT 20;

-- Option 2: Find users by completion status
-- Complete users (for login loop test)
SELECT
  p.email,
  p.full_name,
  usr.completion_pct,
  'Use this for TEST 1: Existing user with complete survey' as note
FROM profiles p
JOIN user_survey_responses usr ON p.user_id = usr.user_id
WHERE usr.completion_pct = 100
ORDER BY p.created_at DESC
LIMIT 5;

-- In-progress users (for resume test)
SELECT
  p.email,
  p.full_name,
  usr.completion_pct,
  usr.current_step,
  'Use this for TEST 1: Existing user mid-survey' as note
FROM profiles p
JOIN user_survey_responses usr ON p.user_id = usr.user_id
WHERE usr.completion_pct > 0 AND usr.completion_pct < 100
ORDER BY p.created_at DESC
LIMIT 5;

-- Never-started users (for fresh survey test)
SELECT
  p.email,
  p.full_name,
  'Use this for TEST 1: Existing user who never started survey' as note
FROM profiles p
LEFT JOIN user_survey_responses usr ON p.user_id = usr.user_id
WHERE usr.user_id IS NULL
ORDER BY p.created_at DESC
LIMIT 5;

-- Option 3: Known test account from session logs
-- This is the account we saw in today's logs
SELECT
  p.user_id,
  p.email,
  p.full_name,
  usr.completion_pct,
  usr.current_step,
  'Known from Oct 20 session logs' as note
FROM profiles p
LEFT JOIN user_survey_responses usr ON p.user_id = usr.user_id
WHERE p.user_id = '78d58a2a-9c8e-44e5-9f87-478d44c0249c';

-- Option 4: Get recent signups (may include your test users)
SELECT
  p.email,
  p.full_name,
  p.city,
  usr.completion_pct,
  p.created_at,
  'Recent signup - check if test account' as note
FROM profiles p
LEFT JOIN user_survey_responses usr ON p.user_id = usr.user_id
WHERE p.created_at > NOW() - INTERVAL '7 days'
ORDER BY p.created_at DESC
LIMIT 10;
