-- Migration: 007_user_survey_responses.sql
-- Purpose: Create user-based survey responses table to save progress directly to users

-- Create user_survey_responses table that links directly to users
CREATE TABLE IF NOT EXISTS user_survey_responses (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    answers_json JSONB DEFAULT '{}',
    completion_pct INTEGER DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
    current_step INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_survey_responses_user ON user_survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_survey_responses_completion ON user_survey_responses(completion_pct);

-- Enable RLS
ALTER TABLE user_survey_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own survey responses
CREATE POLICY "Users can view own survey responses" ON user_survey_responses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own survey responses
CREATE POLICY "Users can insert own survey responses" ON user_survey_responses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own survey responses
CREATE POLICY "Users can update own survey responses" ON user_survey_responses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own survey responses
CREATE POLICY "Users can delete own survey responses" ON user_survey_responses
    FOR DELETE
    USING (auth.uid() = user_id);

-- Update trigger for user_survey_responses
CREATE TRIGGER update_user_survey_responses_updated_at
    BEFORE UPDATE ON user_survey_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT ALL ON user_survey_responses TO authenticated;
GRANT ALL ON user_survey_responses TO service_role;