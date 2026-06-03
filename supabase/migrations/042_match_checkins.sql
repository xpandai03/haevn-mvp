-- Post-date check-in feedback. One row per (viewer partnership, match) after
-- they've mutually signalled ready-to-meet. Used to tune future matching.
-- Accessed only via service-role / admin server code (RLS enabled).

CREATE TABLE IF NOT EXISTS match_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  match_partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('clicked', 'okay', 'no_match')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_checkins_distinct CHECK (partnership_id <> match_partnership_id),
  CONSTRAINT match_checkins_unique UNIQUE (partnership_id, match_partnership_id)
);

CREATE INDEX IF NOT EXISTS idx_match_checkins_viewer
  ON match_checkins (partnership_id);

COMMENT ON TABLE match_checkins IS
  'Post-date check-in feedback (clicked/okay/no_match) per viewer+match pair.';

ALTER TABLE match_checkins ENABLE ROW LEVEL SECURITY;
