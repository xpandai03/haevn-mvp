-- Migration: 008_user_onboarding_state.sql
-- Purpose: Create user onboarding state tracking table

-- Create user_onboarding_state table
CREATE TABLE IF NOT EXISTS user_onboarding_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step TEXT DEFAULT 'expectations',
    identity_completed BOOLEAN DEFAULT FALSE,
    survey_completed BOOLEAN DEFAULT FALSE,
    membership_selected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_onboarding_state_user ON user_onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_state_survey_completed ON user_onboarding_state(survey_completed);

-- Enable RLS
ALTER TABLE user_onboarding_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own onboarding state
CREATE POLICY "Users can view own onboarding state" ON user_onboarding_state
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own onboarding state
CREATE POLICY "Users can insert own onboarding state" ON user_onboarding_state
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own onboarding state
CREATE POLICY "Users can update own onboarding state" ON user_onboarding_state
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Update trigger for user_onboarding_state
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_onboarding_state_updated_at
    BEFORE UPDATE ON user_onboarding_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT ALL ON user_onboarding_state TO authenticated;
GRANT ALL ON user_onboarding_state TO service_role;