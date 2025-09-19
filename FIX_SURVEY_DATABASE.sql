-- Fix for survey_responses table and survey functionality
-- Run this in Supabase SQL Editor

-- 1. Add missing current_step column to survey_responses
ALTER TABLE survey_responses
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;

-- 2. Update RLS policies for survey_responses
DROP POLICY IF EXISTS "Users can view own survey" ON survey_responses;
DROP POLICY IF EXISTS "Users can update own survey" ON survey_responses;
DROP POLICY IF EXISTS "Users can insert own survey" ON survey_responses;

-- Simple RLS policies for survey_responses
CREATE POLICY "survey_select_own" ON survey_responses
  FOR SELECT USING (
    partnership_id IN (
      SELECT id FROM partnerships WHERE owner_id = auth.uid()
      UNION
      SELECT partnership_id FROM partnership_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "survey_insert_own" ON survey_responses
  FOR INSERT WITH CHECK (
    partnership_id IN (
      SELECT id FROM partnerships WHERE owner_id = auth.uid()
      UNION
      SELECT partnership_id FROM partnership_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "survey_update_own" ON survey_responses
  FOR UPDATE USING (
    partnership_id IN (
      SELECT id FROM partnerships WHERE owner_id = auth.uid()
      UNION
      SELECT partnership_id FROM partnership_members WHERE user_id = auth.uid()
    )
  );

-- 3. Ensure RLS is enabled
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- 4. Create a function to get or create survey response
CREATE OR REPLACE FUNCTION get_or_create_survey(p_partnership_id UUID)
RETURNS UUID AS $$
DECLARE
  v_survey_id UUID;
BEGIN
  -- Try to get existing survey
  SELECT id INTO v_survey_id
  FROM survey_responses
  WHERE partnership_id = p_partnership_id;

  -- If doesn't exist, create it
  IF v_survey_id IS NULL THEN
    INSERT INTO survey_responses (partnership_id, answers_json, completion_pct, current_step)
    VALUES (p_partnership_id, '{}'::jsonb, 0, 0)
    RETURNING id INTO v_survey_id;
  END IF;

  RETURN v_survey_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_or_create_survey TO authenticated;

-- 5. Verify the schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'survey_responses'
AND table_schema = 'public'
ORDER BY ordinal_position;