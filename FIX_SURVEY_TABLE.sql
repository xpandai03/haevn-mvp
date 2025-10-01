-- COMPREHENSIVE FIX FOR SURVEY SAVE ISSUES
-- Run this in Supabase Studio SQL Editor
-- This ensures the user_survey_responses table exists with proper RLS policies

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can insert own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can update own survey responses" ON user_survey_responses;
DROP POLICY IF EXISTS "Users can delete own survey responses" ON user_survey_responses;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_survey_responses_updated_at ON user_survey_responses;

-- Create user_survey_responses table (IF NOT EXISTS is safe)
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

-- Create RLS Policies with better names to avoid conflicts
CREATE POLICY "user_survey_select_own" ON user_survey_responses
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "user_survey_insert_own" ON user_survey_responses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_survey_update_own" ON user_survey_responses
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_survey_delete_own" ON user_survey_responses
    FOR DELETE
    USING (auth.uid() = user_id);

-- Update trigger for user_survey_responses
-- The update_updated_at function should already exist from migration 001
CREATE TRIGGER update_user_survey_responses_updated_at
    BEFORE UPDATE ON user_survey_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON user_survey_responses TO authenticated;
GRANT ALL ON user_survey_responses TO service_role;

-- Verify the setup
SELECT
    'Table exists: ' || EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'user_survey_responses'
    )::text as table_check,
    'RLS enabled: ' || (
        SELECT relrowsecurity FROM pg_class
        WHERE relname = 'user_survey_responses'
    )::text as rls_check,
    'Policies count: ' || COUNT(*)::text as policies_count
FROM pg_policies
WHERE tablename = 'user_survey_responses';