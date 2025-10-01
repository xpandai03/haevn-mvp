-- Create user_survey_responses table and reload schema
-- Run this in Production Supabase SQL Editor

-- Drop table if exists to start fresh
DROP TABLE IF EXISTS public.user_survey_responses CASCADE;

-- Create the table
CREATE TABLE public.user_survey_responses (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    answers_json JSONB DEFAULT '{}'::jsonb,
    completion_pct INTEGER DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
    current_step INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_user_survey_responses_user ON public.user_survey_responses(user_id);
CREATE INDEX idx_user_survey_responses_completion ON public.user_survey_responses(completion_pct);

-- Enable RLS
ALTER TABLE public.user_survey_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own survey responses"
ON public.user_survey_responses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own survey responses"
ON public.user_survey_responses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own survey responses"
ON public.user_survey_responses FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own survey responses"
ON public.user_survey_responses FOR DELETE
USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.user_survey_responses TO authenticated;
GRANT ALL ON public.user_survey_responses TO service_role;
GRANT ALL ON public.user_survey_responses TO anon;

-- CRITICAL: Reload the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'user_survey_responses table created and schema reloaded' AS status;
