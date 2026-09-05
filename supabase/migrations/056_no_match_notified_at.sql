-- 056_no_match_notified_at.sql
-- =============================================================================
-- UNIVERSAL MATCH MONDAY — the no-match ping's per-member cadence marker
-- =============================================================================
-- Every member with a completed survey should hear from HAEVN on a Monday:
-- their match, or a "no match yet" ping. The ping repeats on a configurable
-- interval (NO_MATCH_PING_EVERY_N_WEEKS), and that interval is PER MEMBER, not
-- global — a member who joins mid-cycle gets their first touch immediately and
-- their second one N weeks later, rather than being swept into a global cohort.
--
-- So one nullable timestamp is all that is needed:
--   NULL          -> never pinged; due on the next run (the first touch)
--   a timestamp   -> due again once N weeks (less a small grace) have passed
--
-- SET ON SUCCESSFUL SEND ONLY. A send that fails on every channel leaves this
-- NULL so the member is retried on the next eligible run rather than silently
-- skipped forever. That is the same rule notify-matches already applies to
-- computed_matches.sms_notified_at, and for the same reason.
--
-- WHY NOT REUSE sms_notified_at: that column lives on computed_matches and marks
-- a PAIR as notified. The ping audience is defined by the ABSENCE of a visible
-- pair, so those members have no row to mark. The marker has to live on the
-- member unit, which is the partnership.
--
-- WHY NOT A NEW LOG TABLE: the ping needs one question answered — "when did we
-- last ping this partnership?" A column answers it in the same read that already
-- fetches partnerships for the audience build, with no join and no second write.
-- (renotify_log exists for the re-notify engine because that engine reports on
-- per-run outcomes; this one does not.)
--
-- ADDITIVE, NULLABLE, REVERSIBLE. No default, no backfill, no rewrite of
-- existing rows: every partnership starts NULL, which is exactly "never pinged".
-- Rollback: ALTER TABLE partnerships DROP COLUMN no_match_notified_at;
--
-- IDEMPOTENT — safe to re-run anywhere.
-- =============================================================================

ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS no_match_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN partnerships.no_match_notified_at IS
  'When the "no match yet" Match Monday ping was last SUCCESSFULLY delivered to this partnership on any channel. NULL = never pinged (due on the next run). Drives the per-member repeat interval NO_MATCH_PING_EVERY_N_WEEKS. Never set on a failed send, so a failure retries rather than silently skipping.';

-- The ping audience scans partnerships and asks "due yet?". Partial index: the
-- never-pinged rows (the whole base on day one) are found without a scan, and
-- the index stays small as members acquire a timestamp.
CREATE INDEX IF NOT EXISTS idx_partnerships_no_match_notified_at
  ON partnerships (no_match_notified_at);
