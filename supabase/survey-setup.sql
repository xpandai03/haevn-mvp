-- Create survey_responses table if not exists
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers_json JSONB DEFAULT '{}',
  completion_pct INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique response per partnership
  UNIQUE(partnership_id, user_id)
);

-- Enable RLS
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage own survey responses" ON public.survey_responses;

-- Create RLS policy for users to manage their own survey responses
CREATE POLICY "Users can manage own survey responses" ON public.survey_responses
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_survey_responses_partnership_user
  ON public.survey_responses(partnership_id, user_id);

-- Grant permissions
GRANT ALL ON public.survey_responses TO authenticated;

-- Function to update survey completion status
CREATE OR REPLACE FUNCTION update_survey_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- When survey reaches 100%, update profile
  IF NEW.completion_pct = 100 THEN
    UPDATE public.profiles
    SET survey_complete = true,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for survey completion
DROP TRIGGER IF EXISTS on_survey_complete ON public.survey_responses;
CREATE TRIGGER on_survey_complete
  AFTER INSERT OR UPDATE OF completion_pct ON public.survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_completion();