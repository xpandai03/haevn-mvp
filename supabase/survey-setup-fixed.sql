-- Create survey_responses table if not exists
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  answers_json JSONB DEFAULT '{}',
  completion_pct INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique response per partnership
  UNIQUE(partnership_id)
);

-- Enable RLS
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own survey" ON public.survey_responses;
DROP POLICY IF EXISTS "Users can update own survey" ON public.survey_responses;
DROP POLICY IF EXISTS "Users can insert own survey" ON public.survey_responses;

-- Create RLS policies (users can manage survey through their partnership membership)
CREATE POLICY "Users can view own survey" ON public.survey_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = survey_responses.partnership_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own survey" ON public.survey_responses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = survey_responses.partnership_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own survey" ON public.survey_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = survey_responses.partnership_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_survey_responses_partnership
  ON public.survey_responses(partnership_id);

-- Grant permissions
GRANT ALL ON public.survey_responses TO authenticated;

-- Function to update survey completion status
CREATE OR REPLACE FUNCTION update_survey_completion()
RETURNS TRIGGER AS $$
DECLARE
  user_ids UUID[];
BEGIN
  -- When survey reaches 100%, update all member profiles
  IF NEW.completion_pct = 100 THEN
    -- Get all user IDs for this partnership
    SELECT ARRAY_AGG(user_id) INTO user_ids
    FROM partnership_members
    WHERE partnership_id = NEW.partnership_id;

    -- Update all member profiles
    UPDATE public.profiles
    SET survey_complete = true,
        updated_at = NOW()
    WHERE user_id = ANY(user_ids);
  END IF;

  -- Update the partnership's updated_at timestamp
  UPDATE public.partnerships
  SET updated_at = NOW()
  WHERE id = NEW.partnership_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for survey completion
DROP TRIGGER IF EXISTS on_survey_complete ON public.survey_responses;
CREATE TRIGGER on_survey_complete
  AFTER INSERT OR UPDATE OF completion_pct ON public.survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_completion();