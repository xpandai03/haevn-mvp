-- Migration: Add partnership_id to user_survey_responses
-- Purpose: Enable survey responses to be linked to partnerships while maintaining backward compatibility
-- Date: 2025-11-03
-- Phase: 1.1 - Data Model Migration

-- Step 1: Add partnership_id column (nullable for existing records)
ALTER TABLE user_survey_responses
ADD COLUMN IF NOT EXISTS partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE;

-- Step 2: Create index for faster partnership-based lookups
CREATE INDEX IF NOT EXISTS idx_user_survey_responses_partnership
ON user_survey_responses(partnership_id);

-- Step 3: Backfill - Associate existing user surveys with their partnerships
-- This finds each user's partnership and links their survey to it
UPDATE user_survey_responses usr
SET partnership_id = pm.partnership_id
FROM partnership_members pm
WHERE usr.user_id = pm.user_id
  AND usr.partnership_id IS NULL  -- Only update records that haven't been migrated yet
  AND pm.role = 'owner';  -- Link to partnership where user is owner

-- Step 4: Add constraint - Survey must belong to either a user OR a partnership
-- This ensures data integrity: solo users have user_id set, partnerships have partnership_id set
ALTER TABLE user_survey_responses
DROP CONSTRAINT IF EXISTS user_survey_responses_ownership_check;

ALTER TABLE user_survey_responses
ADD CONSTRAINT user_survey_responses_ownership_check
CHECK (
  (user_id IS NOT NULL AND partnership_id IS NULL) OR
  (user_id IS NULL AND partnership_id IS NOT NULL)
);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN user_survey_responses.partnership_id IS
'Links survey to a partnership for multi-partner shared surveys. Mutually exclusive with user_id.';

-- Verification query (commented out - run manually to verify migration)
-- SELECT
--   COUNT(*) as total_surveys,
--   COUNT(user_id) as user_surveys,
--   COUNT(partnership_id) as partnership_surveys,
--   COUNT(*) FILTER (WHERE user_id IS NOT NULL AND partnership_id IS NOT NULL) as invalid_both,
--   COUNT(*) FILTER (WHERE user_id IS NULL AND partnership_id IS NULL) as invalid_neither
-- FROM user_survey_responses;
