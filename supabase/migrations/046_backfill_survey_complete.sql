-- 046_backfill_survey_complete.sql
-- =============================================================================
-- ONE-TIME BACKFILL — promote profiles.survey_complete for already-complete surveys
-- =============================================================================
-- WHY: profiles.survey_complete was only reliably set by the webhook ingest path
-- (live 2026-07-17). Pre-webhook manual-import users have completion_pct >= 100
-- in user_survey_responses but survey_complete = false. This backfills the boolean
-- so its OTHER consumers (discovery gating, member export, etc.) are truthful.
-- The dashboard metric itself no longer reads this boolean (see PR #6 / getMetrics).
--
-- SAFETY:
--   * PROMOTE-ONLY — sets survey_complete = true, and only WHERE it is currently
--     false. Never demotes. The known anomaly (survey_complete = true with
--     completion_pct < 100, count ~1) is untouched by construction.
--   * IDEMPOTENT — the `survey_complete = false` guard means a re-run matches 0 rows.
--   * ADDITIVE / reversible in spirit — flips a boolean; no rows/columns created or dropped.
--
-- EXPECTED: ~346 rows on first apply (read-only pin 2026-07-23). Fewer if the
-- webhook has promoted some in the interim — that's fine, the predicate is exact.
--
-- Run in the deploy window alongside the getMetrics change so the boolean and the
-- (already-corrected) dashboard card agree from the first post-deploy render.
-- =============================================================================

UPDATE profiles p
SET survey_complete = true
WHERE p.survey_complete = false
  AND EXISTS (
    SELECT 1
    FROM user_survey_responses u
    WHERE u.user_id = p.user_id
      AND u.completion_pct >= 100
  );

-- Verification (run after): expect 0 rows still pending, i.e. re-running the
-- UPDATE above touches nothing.
--   SELECT count(*) FROM profiles p
--   WHERE p.survey_complete = false
--     AND EXISTS (SELECT 1 FROM user_survey_responses u
--                 WHERE u.user_id = p.user_id AND u.completion_pct >= 100);
