-- HAEVN AI Trust Layer — Summary Storage
-- Adds columns for AI-generated Connection Summary and HAEVN Insight

ALTER TABLE partnerships
ADD COLUMN IF NOT EXISTS connection_summary TEXT,
ADD COLUMN IF NOT EXISTS haevn_insight TEXT,
ADD COLUMN IF NOT EXISTS summaries_version TEXT DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS summaries_generated_at TIMESTAMPTZ;

-- Index for querying partnerships that need summary generation
CREATE INDEX IF NOT EXISTS idx_partnerships_summaries_generated
ON partnerships (summaries_generated_at)
WHERE connection_summary IS NOT NULL;

COMMENT ON COLUMN partnerships.connection_summary IS 'AI-generated outward-facing summary visible to matches/connections';
COMMENT ON COLUMN partnerships.haevn_insight IS 'AI-generated private insight visible only to the user';
COMMENT ON COLUMN partnerships.summaries_version IS 'Version tag for the generation pipeline (e.g. v1)';
COMMENT ON COLUMN partnerships.summaries_generated_at IS 'Timestamp of last summary generation';
