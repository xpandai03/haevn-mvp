-- Hidden (passed) matches. One row per (viewer partnership, hidden match).
-- A match stays hidden for 30 days, then auto-reappears (rows with
-- expires_at <= now() are ignored by the app and may be cleaned up).
-- Accessed only via service-role / admin server code (RLS enabled).

CREATE TABLE IF NOT EXISTS hidden_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  match_partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  CONSTRAINT hidden_matches_distinct CHECK (partnership_id <> match_partnership_id),
  CONSTRAINT hidden_matches_unique UNIQUE (partnership_id, match_partnership_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_matches_viewer
  ON hidden_matches (partnership_id, expires_at);

COMMENT ON TABLE hidden_matches IS
  'Matches a viewer partnership has passed on. Hidden for 30 days (expires_at), then auto-reappears.';

ALTER TABLE hidden_matches ENABLE ROW LEVEL SECURITY;
