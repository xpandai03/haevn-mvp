-- ============================================================================
-- Link raunek@tester.com to Test Partnership with Matches
-- ============================================================================
-- This connects your existing account to the test partnership so you can see matches

-- Step 1: Update partnership_members to link your account
UPDATE partnership_members
SET user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
WHERE partnership_id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Step 2: Update the partnership owner
UPDATE partnerships
SET owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Step 3: Update profile
UPDATE profiles
SET city = 'San Francisco',
    survey_complete = true
WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;

-- Step 4: Verify it worked
SELECT
  p.display_name,
  p.identity,
  p.seeking_targets,
  u.email as owner_email
FROM partnerships p
JOIN auth.users u ON u.id = p.owner_id
WHERE p.id = '11111111-1111-1111-1111-111111111111'::uuid;

-- Step 5: Check all partnerships (should see 4 total)
SELECT
  display_name,
  identity,
  city
FROM partnerships
ORDER BY created_at DESC;
