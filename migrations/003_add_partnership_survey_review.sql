-- Migration: Add Partnership Survey Review Tracking
-- Purpose: Track which partners have reviewed and approved the shared survey
-- Date: 2025-11-03
-- Phase: 1.3 - Data Model Migration

-- Step 1: Add survey review columns to partnership_members
ALTER TABLE partnership_members
ADD COLUMN IF NOT EXISTS survey_reviewed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS survey_reviewed_at TIMESTAMPTZ;

-- Step 2: Create index for faster review status lookups
CREATE INDEX IF NOT EXISTS idx_partnership_members_survey_reviewed
ON partnership_members(partnership_id, survey_reviewed);

-- Step 3: Backfill - Auto-mark existing owners as having reviewed their surveys
-- Owners who created the survey are automatically considered to have reviewed it
UPDATE partnership_members
SET survey_reviewed = true,
    survey_reviewed_at = NOW()
WHERE role = 'owner'
  AND survey_reviewed = false;

-- Step 4: Create trigger function to auto-mark owners as reviewed on insert
-- When a new owner is added, they automatically have survey_reviewed = true
CREATE OR REPLACE FUNCTION auto_mark_owner_survey_reviewed()
RETURNS TRIGGER AS $$
BEGIN
  -- If the new member is an owner, auto-approve survey review
  IF NEW.role = 'owner' THEN
    NEW.survey_reviewed = true;
    NEW.survey_reviewed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to execute the function on insert
DROP TRIGGER IF EXISTS on_partnership_member_insert ON partnership_members;

CREATE TRIGGER on_partnership_member_insert
  BEFORE INSERT ON partnership_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_owner_survey_reviewed();

-- Step 6: Add comments for documentation
COMMENT ON COLUMN partnership_members.survey_reviewed IS
'Indicates whether this partnership member has reviewed and approved the shared survey responses';

COMMENT ON COLUMN partnership_members.survey_reviewed_at IS
'Timestamp when the member marked the survey as reviewed';

COMMENT ON FUNCTION auto_mark_owner_survey_reviewed() IS
'Automatically marks partnership owners as having reviewed the survey when they are added';

-- Step 7: Create helper function to check if partnership survey is fully reviewed
-- Returns true if all members have reviewed the survey
CREATE OR REPLACE FUNCTION is_partnership_survey_reviewed(p_partnership_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_members INTEGER;
  reviewed_members INTEGER;
BEGIN
  -- Count total members
  SELECT COUNT(*) INTO total_members
  FROM partnership_members
  WHERE partnership_id = p_partnership_id;

  -- Count members who have reviewed
  SELECT COUNT(*) INTO reviewed_members
  FROM partnership_members
  WHERE partnership_id = p_partnership_id
    AND survey_reviewed = true;

  -- All members must have reviewed
  RETURN total_members > 0 AND total_members = reviewed_members;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_partnership_survey_reviewed(UUID) IS
'Returns true if all members of a partnership have reviewed the shared survey';

-- Verification queries (commented out - run manually to verify migration)
-- Check review status for all partnerships:
-- SELECT
--   p.id as partnership_id,
--   COUNT(pm.user_id) as total_members,
--   COUNT(pm.user_id) FILTER (WHERE pm.survey_reviewed = true) as reviewed_members,
--   is_partnership_survey_reviewed(p.id) as fully_reviewed
-- FROM partnerships p
-- LEFT JOIN partnership_members pm ON p.id = pm.partnership_id
-- GROUP BY p.id;
