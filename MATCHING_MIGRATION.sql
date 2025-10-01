-- ============================================================================
-- HAEVN Matching System Migration
-- ============================================================================
-- This migration adds the minimal fields needed for the scoring engine
-- to work with existing partnerships and survey_responses tables

-- Add matching-related fields to partnerships table
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS identity TEXT CHECK (identity IN ('single', 'couple', 'throuple')),
  ADD COLUMN IF NOT EXISTS seeking_targets TEXT[], -- Array of identities they're seeking
  ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age >= 18 AND age <= 120),
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS msa TEXT, -- Metropolitan Statistical Area
  ADD COLUMN IF NOT EXISTS discretion_level TEXT CHECK (discretion_level IN ('Low', 'Medium', 'High')),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_background_check BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_completeness DECIMAL(3,2) DEFAULT 0.0 CHECK (profile_completeness >= 0 AND profile_completeness <= 1.0);

-- Create computed matches view (cached scoring results)
CREATE TABLE IF NOT EXISTS computed_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_a UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  partnership_b UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  tier TEXT NOT NULL CHECK (tier IN ('Platinum', 'Gold', 'Silver', 'Bronze', 'Excluded')),
  breakdown JSONB, -- Stores score breakdown for display
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partnership_a, partnership_b)
);

-- Index for fast match lookups
CREATE INDEX IF NOT EXISTS idx_computed_matches_partnership_a ON computed_matches(partnership_a);
CREATE INDEX IF NOT EXISTS idx_computed_matches_score ON computed_matches(partnership_a, score DESC);
CREATE INDEX IF NOT EXISTS idx_computed_matches_tier ON computed_matches(partnership_a, tier);

-- Enable RLS on computed_matches
ALTER TABLE computed_matches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own matches
CREATE POLICY "Users can view their matches" ON computed_matches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = computed_matches.partnership_a
        AND partnership_members.user_id = auth.uid()
    )
  );

-- Add indexes for matching queries
CREATE INDEX IF NOT EXISTS idx_partnerships_identity ON partnerships(identity);
CREATE INDEX IF NOT EXISTS idx_partnerships_seeking ON partnerships USING GIN(seeking_targets);
CREATE INDEX IF NOT EXISTS idx_partnerships_location ON partnerships(msa, city);

-- Add trigger to update partnerships updated_at
CREATE OR REPLACE FUNCTION update_partnerships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_partnerships_updated_at
  BEFORE UPDATE ON partnerships
  FOR EACH ROW
  EXECUTE FUNCTION update_partnerships_updated_at();

-- Comments for documentation
COMMENT ON TABLE computed_matches IS 'Pre-computed match scores between partnerships for performance';
COMMENT ON COLUMN partnerships.identity IS 'User identity: single, couple, or throuple';
COMMENT ON COLUMN partnerships.seeking_targets IS 'Array of identities this partnership is seeking';
COMMENT ON COLUMN partnerships.msa IS 'Metropolitan Statistical Area for geographic matching';
