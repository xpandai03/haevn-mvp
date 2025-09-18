-- HAEVN Onboarding Survey Enhancements
-- Migration: 004_onboarding_survey.sql
-- Description: Add current_step tracking and advocate_mode flag

-- Add current_step to survey_responses for resume functionality
ALTER TABLE survey_responses
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;

-- Add advocate_mode to partnerships for single-partner completion
ALTER TABLE partnerships
ADD COLUMN IF NOT EXISTS advocate_mode BOOLEAN DEFAULT false;

-- Add index for current_step queries
CREATE INDEX IF NOT EXISTS idx_survey_responses_current_step
ON survey_responses(partnership_id, current_step);

-- Add comment for clarity
COMMENT ON COLUMN survey_responses.current_step IS 'Current step index in survey flow for resume functionality';
COMMENT ON COLUMN partnerships.advocate_mode IS 'True when a single partner completes survey for the group';