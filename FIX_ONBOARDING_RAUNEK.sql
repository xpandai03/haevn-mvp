-- ============================================================================
-- Complete Onboarding for raunek@tester.com (FIXED)
-- ============================================================================

-- Step 1: Mark onboarding complete (without profile_type)
INSERT INTO onboarding_state (
  user_id,
  current_step,
  completed_steps,
  updated_at
) VALUES (
  'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid,
  11,
  ARRAY[1,2,3,4,5,6,7,8,9,10,11],
  NOW()
) ON CONFLICT (user_id) DO UPDATE
  SET current_step = 11,
      completed_steps = ARRAY[1,2,3,4,5,6,7,8,9,10,11],
      updated_at = NOW();

-- Step 2: Mark profile as complete
UPDATE profiles
SET survey_complete = true,
    city = 'San Francisco',
    full_name = 'Raunek'
WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;

-- Step 3: Link to test partnership with matches
UPDATE partnership_members
SET user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
WHERE partnership_id = '11111111-1111-1111-1111-111111111111'::uuid;

UPDATE partnerships
SET owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Step 4: Verify everything
SELECT 'Onboarding State' as check_type, current_step, completed_steps
FROM onboarding_state
WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
UNION ALL
SELECT 'Partnership Link' as check_type, NULL, NULL
WHERE EXISTS (
  SELECT 1 FROM partnerships
  WHERE id = '11111111-1111-1111-1111-111111111111'::uuid
    AND owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
);
