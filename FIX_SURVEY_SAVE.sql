-- This migration fixes survey saving by creating a user-based table
-- Run this entire file in Supabase SQL Editor

-- Create the new table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS user_survey_responses (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    answers_json JSONB DEFAULT '{}',
    completion_pct INTEGER DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
    current_step INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_survey_responses_user ON user_survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_survey_responses_completion ON user_survey_responses(completion_pct);

-- Enable Row Level Security
ALTER TABLE user_survey_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (now that table exists)
DROP POLICY IF EXISTS "Users can view own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can insert own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can update own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can delete own survey responses" ON user_survey_responses;

-- Create RLS policies
CREATE POLICY "Users can view own survey responses" ON user_survey_responses
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own survey responses" ON user_survey_responses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own survey responses" ON user_survey_responses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own survey responses" ON user_survey_responses
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create or replace the update trigger
DROP TRIGGER IF EXISTS update_user_survey_responses_updated_at ON user_survey_responses;

CREATE TRIGGER update_user_survey_responses_updated_at
    BEFORE UPDATE ON user_survey_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT ALL ON user_survey_responses TO authenticated;
GRANT ALL ON user_survey_responses TO service_role;

-- Success message
SELECT 'Migration completed successfully! Survey saving is now fixed.' as message;