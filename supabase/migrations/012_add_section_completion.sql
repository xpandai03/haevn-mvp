-- Add section completion tracking to survey responses
-- This allows us to show celebration modals after each section completion

ALTER TABLE survey_responses
ADD COLUMN IF NOT EXISTS completed_sections JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN survey_responses.completed_sections IS 'Array of completed section IDs for progress tracking and celebration modals';
