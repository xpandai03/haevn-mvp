-- 049_match_history.sql
-- =============================================================================
-- MATCH HISTORY — append-only weekly capture of the computed_matches set
-- =============================================================================
-- computed_matches is destructively rewritten every Monday recompute, so match
-- churn, pair history, retention, and TRUE lifetime "never matched" are lost
-- unless captured going forward. This table is that capture: one snapshot of the
-- match set per run_date, written by the recompute pipeline (fail-safe — a capture
-- failure never affects the release).
--
-- Stores raw computed_matches rows (both pair directions, as-is); dedup at read
-- time. ~378 rows/week. ADDITIVE / reversible: DROP TABLE match_history.
-- =============================================================================

CREATE TABLE IF NOT EXISTS match_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The recompute run's UTC date (the Monday).
  run_date       DATE NOT NULL,
  partnership_a  UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  partnership_b  UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  score          INTEGER,
  tier           TEXT,
  -- release_at as it stood at capture (post-override), and expiry.
  released_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  computed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE match_history IS
  'Append-only weekly capture of computed_matches (which is rewritten each Monday). One row per (run_date, pair). Source for churn/retention/lifetime-never-matched. Never deleted.';

-- Idempotent re-capture: a re-run of the same day inserts nothing new.
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_history_run_pair
  ON match_history (run_date, partnership_a, partnership_b);

CREATE INDEX IF NOT EXISTS idx_match_history_run ON match_history (run_date DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_pair ON match_history (partnership_a, partnership_b);

ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
-- No policies: written/read only by service-role server code (recompute pipeline + admin route).
