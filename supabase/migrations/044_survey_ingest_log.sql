-- 044_survey_ingest_log.sql
-- =============================================================================
-- SURVEY INGEST — dedupe key + audit trail for the completion_v1 webhook
-- =============================================================================
-- WHY: the marketing survey app (Emergent) POSTs "survey.completed" to
-- /api/ingest/survey on every completion. The sender RETRIES on non-2xx, and
-- webhooks are replayed in practice, so the receiver MUST be idempotent: the
-- same submission_id may arrive many times and must never create a second user.
--
-- Nothing in the schema stored a source submission id before this (the manual
-- importer deduped on auth email only), so there was no idempotency key.
--
-- This table is BOTH:
--   1. the dedupe key   — submission_id is the PRIMARY KEY, so a re-fire hits an
--                         atomic ON CONFLICT (no read-then-write race under the
--                         sender's concurrent retries), and
--   2. the audit trail  — every ingest is recorded with its outcome, so the flow
--                         is visible and failures are detectable (no silent drops).
--
-- Email uniqueness on auth.users remains dedupe layer 2: same human, new
-- submission_id -> update in place, never a duplicate account.
--
-- ADDITIVE + REVERSIBLE: a new table only. Nothing else is altered; dropping it
-- restores the prior state. No user data lives here — only ingest bookkeeping.
-- =============================================================================

CREATE TABLE IF NOT EXISTS survey_ingest_log (
  -- The contract's submission_id (== event_id). PK => idempotency.
  submission_id  TEXT PRIMARY KEY,
  event_id       TEXT,
  -- created | updated | duplicate | rejected | error
  result         TEXT NOT NULL,
  -- Why a payload was rejected / what failed. NULL on success.
  reason         TEXT,
  -- Resolved records (NULL when rejected before creation).
  user_id        UUID,
  partnership_id UUID,
  email          TEXT,
  -- What we resolved for gating: the city we set + whether it mapped to a market.
  -- Lets us answer "why was this person withheld?" without re-deriving.
  resolved_city  TEXT,
  market_resolved BOOLEAN,
  -- Traceability only — never used for gating (gating resolves off
  -- partnerships.city). e.g. the payload's location.market label.
  source_market  TEXT,
  -- Review queue: TRUE when the payload was accepted but something needs a human
  -- (e.g. Q0_JOIN missing -> profile_type could not be derived honestly).
  needs_review   BOOLEAN NOT NULL DEFAULT false,
  review_reason  TEXT,
  photos_imported INTEGER NOT NULL DEFAULT 0,
  photos_failed   INTEGER NOT NULL DEFAULT 0,
  duration_ms    INTEGER,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE survey_ingest_log IS
  'Idempotency key + audit trail for the survey.completed ingest webhook. submission_id is the PK, so retries/replays are atomically deduped. Also the record of every ingest outcome.';
COMMENT ON COLUMN survey_ingest_log.submission_id IS
  'completion_v1 submission_id. PRIMARY KEY = the idempotency guarantee.';
COMMENT ON COLUMN survey_ingest_log.needs_review IS
  'Payload accepted, but a field could not be derived honestly (e.g. Q0_JOIN absent -> profile_type not inferable). Flagged rather than silently defaulted.';
COMMENT ON COLUMN survey_ingest_log.market_resolved IS
  'FALSE = resolved_city maps to no market -> the member is withheld from release (fail closed) until their market goes live.';

CREATE INDEX IF NOT EXISTS idx_survey_ingest_log_received_at ON survey_ingest_log (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_ingest_log_result      ON survey_ingest_log (result);
CREATE INDEX IF NOT EXISTS idx_survey_ingest_log_email       ON survey_ingest_log (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_survey_ingest_log_needs_review ON survey_ingest_log (needs_review) WHERE needs_review;

-- Self-contained (see 043): 001_init was never fully applied to this database,
-- so we declare the helper here rather than depend on it existing.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_survey_ingest_log_updated_at ON survey_ingest_log;
CREATE TRIGGER update_survey_ingest_log_updated_at
  BEFORE UPDATE ON survey_ingest_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
