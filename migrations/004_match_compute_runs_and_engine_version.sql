CREATE TABLE IF NOT EXISTS match_compute_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL DEFAULT 'survey_complete',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'success', 'error')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  candidates_evaluated INTEGER DEFAULT 0,
  matches_written INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_compute_runs_partnership
  ON match_compute_runs(partnership_id);

CREATE INDEX IF NOT EXISTS idx_match_compute_runs_status
  ON match_compute_runs(status);

ALTER TABLE match_compute_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE computed_matches
  ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT '5cat-v1';
