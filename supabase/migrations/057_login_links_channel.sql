-- 057_login_links_channel.sql
-- =============================================================================
-- HANDOFF CHANNEL ATTRIBUTION — which message did the member actually tap?
-- =============================================================================
-- The Monday notify cron mints ONE handoff token per member and puts the same
-- URL in both the SMS and the email, so a consumed token proved someone arrived
-- but not how. Week 1 (Sept 7): 100 members notified, 36 consumed, and only 6 of
-- those 36 were attributable — the 27 members who had no phone and therefore
-- could only have come from email.
--
-- THE CHEAP FIX, and what it deliberately is NOT:
--   The URL as DISPLAYED carries a one-letter marker (?c=e / ?c=s). Same token,
--   two presentations. The landing page passes the marker through its hidden
--   form field and the consume route records it here.
--
--   We did NOT mint two tokens per member. That would double the login_links
--   footprint that also backs the self-serve rate limit (3 per email / 15 min),
--   and it would break "one consume == one member" for reporting. Token count,
--   token semantics and rate-limit counting are all untouched by this change.
--
-- FIRST-TAP ONLY. The token is still single-use, so a member who taps the SMS
-- and then the email is recorded once, as SMS; the second tap sees "already
-- used", exactly as it does today. That is the accepted trade for not minting a
-- second token.
--
-- NULL IS A REAL AND COMMON VALUE, not a defect:
--   - every self-serve sign-in link (no marker is ever added to those);
--   - every row created before this migration;
--   - any tap whose marker was absent, malformed, or unrecognised — the consume
--     route parses defensively and writes NULL rather than failing.
--
-- The write is deliberately NOT part of the atomic single-use claim: it is a
-- separate best-effort update, so if this migration has not been applied yet the
-- statement simply errors and the member still signs in. Analytics is never on
-- the critical path of a member getting into their account.
--
-- ADDITIVE, NULLABLE, REVERSIBLE. No default, no backfill, no rewrite.
-- Rollback: ALTER TABLE login_links DROP COLUMN channel;
--
-- IDEMPOTENT — safe to re-run anywhere.
-- =============================================================================

ALTER TABLE login_links
  ADD COLUMN IF NOT EXISTS channel TEXT;

COMMENT ON COLUMN login_links.channel IS
  'Which message the member tapped to redeem this handoff: ''email'' | ''sms''. NULL = not attributable — a self-serve sign-in link, a row predating this column, or a tap whose ?c= marker was absent or unrecognised. FIRST TAP ONLY: the token is single-use, so a member who taps both channels is recorded once.';

-- Reporting is "today's consumed handoffs, split by channel", so the useful
-- index is on the consumed rows only. Partial keeps it small: the vast majority
-- of rows are never consumed.
CREATE INDEX IF NOT EXISTS idx_login_links_channel_consumed
  ON login_links (channel, consumed_at)
  WHERE consumed_at IS NOT NULL;
