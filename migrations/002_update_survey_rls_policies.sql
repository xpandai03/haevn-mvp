-- Migration: Update RLS Policies for Partnership-Based Survey Access
-- Purpose: Allow partnership members to access and modify shared survey responses
-- Date: 2025-11-03
-- Phase: 1.2 - Data Model Migration

-- Step 1: Drop old user-only policies
DROP POLICY IF EXISTS "Users can view own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can insert own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can update own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can delete own survey responses" ON user_survey_responses;

-- Step 2: Create new policies that support both user-based AND partnership-based access

-- SELECT Policy: Users can view their own surveys OR surveys belonging to their partnerships
CREATE POLICY "survey_select_policy" ON user_survey_responses
  FOR SELECT USING (
    -- Can view own survey (solo user case)
    user_id = auth.uid()
    OR
    -- Can view partnership survey if user is a member
    partnership_id IN (
      SELECT partnership_id
      FROM partnership_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT Policy: Users can create surveys for themselves OR for their partnerships
CREATE POLICY "survey_insert_policy" ON user_survey_responses
  FOR INSERT WITH CHECK (
    -- Can create own survey (solo user case)
    user_id = auth.uid()
    OR
    -- Can create survey for partnership if user is a member
    partnership_id IN (
      SELECT partnership_id
      FROM partnership_members
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE Policy: Users can update their own surveys OR partnership surveys they belong to
CREATE POLICY "survey_update_policy" ON user_survey_responses
  FOR UPDATE
  USING (
    -- Can update own survey (solo user case)
    user_id = auth.uid()
    OR
    -- Can update partnership survey if user is a member
    partnership_id IN (
      SELECT partnership_id
      FROM partnership_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Ensure after update, still has access
    user_id = auth.uid()
    OR
    partnership_id IN (
      SELECT partnership_id
      FROM partnership_members
      WHERE user_id = auth.uid()
    )
  );

-- DELETE Policy: Only partnership owners can delete partnership surveys
-- Solo users can delete their own surveys
CREATE POLICY "survey_delete_policy" ON user_survey_responses
  FOR DELETE USING (
    -- Can delete own survey (solo user case)
    user_id = auth.uid()
    OR
    -- Can delete partnership survey only if user is the owner
    partnership_id IN (
      SELECT partnership_id
      FROM partnership_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- Step 3: Add comments for documentation
COMMENT ON POLICY "survey_select_policy" ON user_survey_responses IS
'Allows users to view their own surveys (user_id match) or surveys belonging to partnerships they are members of';

COMMENT ON POLICY "survey_insert_policy" ON user_survey_responses IS
'Allows users to create surveys for themselves or for partnerships they belong to';

COMMENT ON POLICY "survey_update_policy" ON user_survey_responses IS
'Allows users to update their own surveys or surveys belonging to partnerships they are members of';

COMMENT ON POLICY "survey_delete_policy" ON user_survey_responses IS
'Only allows deletion by the original user (solo) or partnership owner';

-- Verification query (commented out - run manually to verify policies)
-- Test as different users to ensure proper access control:
-- SELECT * FROM user_survey_responses; -- Should only see own or partnership surveys
