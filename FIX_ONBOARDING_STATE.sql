-- This migration creates a simple user-based onboarding state tracking
-- Run this entire file in Supabase SQL Editor to fix onboarding flow

-- Create user onboarding state table
CREATE TABLE IF NOT EXISTS user_onboarding_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step TEXT DEFAULT 'identity',
    completed_steps TEXT[] DEFAULT '{}',
    identity_completed BOOLEAN DEFAULT false,
    survey_completed BOOLEAN DEFAULT false,
    membership_selected BOOLEAN DEFAULT false,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_onboarding_state_user ON user_onboarding_state(user_id);

-- Enable Row Level Security
ALTER TABLE user_onboarding_state ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own onboarding state" ON user_onboarding_state;
DROP POLICY IF EXISTS "Users can insert own onboarding state" ON user_onboarding_state;
DROP POLICY IF EXISTS "Users can update own onboarding state" ON user_onboarding_state;

-- Create RLS policies
CREATE POLICY "Users can view own onboarding state" ON user_onboarding_state
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding state" ON user_onboarding_state
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding state" ON user_onboarding_state
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create update trigger
DROP TRIGGER IF EXISTS update_user_onboarding_state_updated_at ON user_onboarding_state;

CREATE TRIGGER update_user_onboarding_state_updated_at
    BEFORE UPDATE ON user_onboarding_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT ALL ON user_onboarding_state TO authenticated;
GRANT ALL ON user_onboarding_state TO service_role;

-- Success message
SELECT 'Onboarding state tracking fixed! Users will now skip completed steps.' as message;