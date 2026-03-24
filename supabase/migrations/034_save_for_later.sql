-- Save-for-Later Feature
-- Adds saved flag to computed_matches to pause expiration

ALTER TABLE computed_matches
ADD COLUMN IF NOT EXISTS saved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

-- Index for querying saved matches efficiently
CREATE INDEX IF NOT EXISTS idx_computed_matches_saved
ON computed_matches (partnership_a, saved)
WHERE saved = TRUE;

COMMENT ON COLUMN computed_matches.saved IS 'When true, match expiration is paused';
COMMENT ON COLUMN computed_matches.saved_at IS 'Timestamp when the match was saved';
