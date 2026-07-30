-- 050_ready_to_meet_band.sql
-- =============================================================================
-- Recommendation accept-flow: tag each ready-to-meet signal with the band the
-- responder saw it in ('rec' = 77–79 near-miss, 'match' = >=80). This lets a
-- rec-proceed and a match "ready to meet IRL" signal share one table yet stay
-- queryable as distinct product actions (admin status, analytics).
--
-- ADDITIVE + REVERSIBLE. Nullable, no default: EVERY existing row stays NULL and
-- EVERY existing flow (the matches-page ReadyToMeetButton, admin derivation,
-- deriveState) is byte-for-byte unaffected — nothing reads this column unless it
-- opts in. To revert: ALTER TABLE ready_to_meet_signals DROP COLUMN band_at_signal.
-- =============================================================================

ALTER TABLE ready_to_meet_signals
  ADD COLUMN IF NOT EXISTS band_at_signal TEXT
    CHECK (band_at_signal IS NULL OR band_at_signal IN ('rec', 'match'));

COMMENT ON COLUMN ready_to_meet_signals.band_at_signal IS
  'Band the responder saw when signalling: rec (77-79) or match (>=80). NULL = legacy/match-page signal (pre-050). Rec-band signals drive the recommendation accept→connection flow.';
