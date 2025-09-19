-- Migration: 006_onboarding_flow_fixes.sql
-- Purpose: Add missing fields for complete onboarding flow per HAEVN Bible

-- Create profile type enum
CREATE TYPE IF NOT EXISTS profile_type AS ENUM ('solo', 'couple', 'pod');

-- Create verification status enum
CREATE TYPE IF NOT EXISTS verification_status AS ENUM ('none', 'pending', 'verified');

-- Add missing fields to partnerships table
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS profile_type profile_type DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS relationship_orientation TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Create onboarding_state table for detailed tracking
CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps JSONB DEFAULT '[]',
  last_active TIMESTAMPTZ DEFAULT NOW(),
  expectations_viewed BOOLEAN DEFAULT false,
  welcome_viewed BOOLEAN DEFAULT false,
  identity_completed BOOLEAN DEFAULT false,
  verification_skipped BOOLEAN DEFAULT false,
  survey_intro_viewed BOOLEAN DEFAULT false,
  survey_completed BOOLEAN DEFAULT false,
  celebration_viewed BOOLEAN DEFAULT false,
  membership_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(partnership_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_partnerships_profile_type ON partnerships(profile_type);
CREATE INDEX IF NOT EXISTS idx_partnerships_verification_status ON partnerships(verification_status);
CREATE INDEX IF NOT EXISTS idx_partnerships_onboarding_step ON partnerships(onboarding_step);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_user ON onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_partnership ON onboarding_state(partnership_id);

-- Enable RLS on onboarding_state
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_state
-- Partnership members can view their partnership's onboarding state
CREATE POLICY "Partnership members can view onboarding state" ON onboarding_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = onboarding_state.partnership_id
      AND pm.user_id = auth.uid()
    )
  );

-- Partnership members can update their onboarding state
CREATE POLICY "Partnership members can update onboarding state" ON onboarding_state
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = onboarding_state.partnership_id
      AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = onboarding_state.partnership_id
      AND pm.user_id = auth.uid()
    )
  );

-- Partnership members can insert onboarding state for their partnership
CREATE POLICY "Partnership members can insert onboarding state" ON onboarding_state
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = partnership_id
      AND pm.user_id = auth.uid()
    )
  );

-- Update trigger for onboarding_state
CREATE OR REPLACE FUNCTION update_onboarding_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_active = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_onboarding_state_timestamp
  BEFORE UPDATE ON onboarding_state
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_state_updated_at();

-- Function to get or create onboarding state
CREATE OR REPLACE FUNCTION get_or_create_onboarding_state(p_user_id UUID, p_partnership_id UUID)
RETURNS UUID AS $$
DECLARE
  v_state_id UUID;
BEGIN
  -- Try to get existing state by partnership
  SELECT id INTO v_state_id
  FROM onboarding_state
  WHERE partnership_id = p_partnership_id;

  -- Create if doesn't exist
  IF v_state_id IS NULL THEN
    INSERT INTO onboarding_state (user_id, partnership_id)
    VALUES (p_user_id, p_partnership_id)
    RETURNING id INTO v_state_id;
  END IF;

  RETURN v_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_or_create_onboarding_state TO authenticated;

-- Function to mark a step as completed
CREATE OR REPLACE FUNCTION mark_onboarding_step_complete(
  p_partnership_id UUID,
  p_step_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_current_steps JSONB;
  v_new_step INTEGER;
  v_result JSONB;
BEGIN
  -- Get current completed steps
  SELECT completed_steps INTO v_current_steps
  FROM onboarding_state
  WHERE partnership_id = p_partnership_id;

  -- Add step if not already completed
  IF v_current_steps IS NULL THEN
    v_current_steps := '[]'::jsonb;
  END IF;

  IF NOT v_current_steps ? p_step_name THEN
    v_current_steps := v_current_steps || to_jsonb(p_step_name);
  END IF;

  -- Map step name to next step number
  v_new_step := CASE p_step_name
    WHEN 'signup' THEN 2
    WHEN 'expectations' THEN 3
    WHEN 'welcome' THEN 4
    WHEN 'identity' THEN 5
    WHEN 'verification' THEN 6
    WHEN 'survey-intro' THEN 7
    WHEN 'survey' THEN 8
    WHEN 'celebration' THEN 9
    WHEN 'membership' THEN 10
    ELSE current_step
  END FROM onboarding_state WHERE partnership_id = p_partnership_id;

  -- Update the state
  UPDATE onboarding_state
  SET
    completed_steps = v_current_steps,
    current_step = GREATEST(current_step, v_new_step),
    expectations_viewed = CASE WHEN p_step_name = 'expectations' THEN true ELSE expectations_viewed END,
    welcome_viewed = CASE WHEN p_step_name = 'welcome' THEN true ELSE welcome_viewed END,
    identity_completed = CASE WHEN p_step_name = 'identity' THEN true ELSE identity_completed END,
    verification_skipped = CASE WHEN p_step_name = 'verification' THEN true ELSE verification_skipped END,
    survey_intro_viewed = CASE WHEN p_step_name = 'survey-intro' THEN true ELSE survey_intro_viewed END,
    survey_completed = CASE WHEN p_step_name = 'survey' THEN true ELSE survey_completed END,
    celebration_viewed = CASE WHEN p_step_name = 'celebration' THEN true ELSE celebration_viewed END,
    membership_selected = CASE WHEN p_step_name = 'membership' THEN true ELSE membership_selected END
  WHERE partnership_id = p_partnership_id
  RETURNING jsonb_build_object(
    'current_step', current_step,
    'completed_steps', completed_steps
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_onboarding_step_complete TO authenticated;