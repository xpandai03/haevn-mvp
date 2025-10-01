-- ============================================================================
-- Complete Onboarding for raunek@tester.com
-- ============================================================================
-- This marks all onboarding steps as complete so you skip straight to dashboard

-- Step 1: Update onboarding state to mark everything complete
INSERT INTO onboarding_state (
  user_id,
  current_step,
  completed_steps,
  profile_type,
  updated_at
) VALUES (
  'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid,
  11, -- Final step
  ARRAY[1,2,3,4,5,6,7,8,9,10,11], -- All steps completed
  'solo',
  NOW()
) ON CONFLICT (user_id) DO UPDATE
  SET current_step = 11,
      completed_steps = ARRAY[1,2,3,4,5,6,7,8,9,10,11],
      profile_type = 'solo',
      updated_at = NOW();

-- Step 2: Mark profile as complete
UPDATE profiles
SET survey_complete = true,
    city = 'San Francisco',
    full_name = 'Raunek'
WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;

-- Step 3: Verify onboarding state
SELECT
  user_id,
  current_step,
  completed_steps,
  profile_type
FROM onboarding_state
WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;
