-- 053_impersonation_handoff.sql
-- =============================================================================
-- IMPERSONATION HANDOFF TOKEN — stop the sign-in link being burned before use
-- =============================================================================
-- WHY (incident, 2026-08-25/26): the impersonate route returned a Supabase
-- magic link directly to the admin's browser. In four separate attempts the
-- token was redeemed 1.6-2.7s after the audit row was written — far faster than
-- a human can copy a link and paste it into a guest profile. Something in the
-- admin's browser/network path (link scanner, security extension, unfurl) GETs
-- any URL it sees. The human's click was therefore always the SECOND open, and
-- Supabase answered "Email link is invalid or has expired".
--
-- THE FIX: the admin no longer receives a magic link at all. They receive an
-- opaque handoff token whose GET landing page does nothing. The magic link is
-- generated server-side only on an explicit POST, and exists for exactly one
-- redirect. A scanner can fetch the landing page all day and burn nothing.
--
-- WHAT THIS TABLE NOW HOLDS: still never a credential. token_hash is a SHA-256
-- of the handoff token; the raw token exists only in the admin's URL. A reader
-- with full DB access cannot turn any column here into a session.
--
-- Bonus: consumed_at makes "was this link actually used?" answerable from the
-- audit table. During the incident it could only be INFERRED from
-- auth.users.last_sign_in_at, which records the latest sign-in only.
--
-- ADDITIVE / reversible: all columns nullable, no existing column touched.
-- Rollback: ALTER TABLE impersonation_log DROP COLUMN token_hash, ... ;
-- Pre-053 rows simply have NULLs (they were never handoff-based).
-- =============================================================================

ALTER TABLE impersonation_log
  -- SHA-256 (hex) of the 256-bit handoff token. NOT the token, NOT a link.
  ADD COLUMN IF NOT EXISTS token_hash  TEXT,
  -- Handoff TTL — 15 minutes from generation (lib/admin/impersonation.ts).
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  -- Set by the ONE atomic conditional UPDATE that redeems the handoff.
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
  -- First hop of x-forwarded-for at redemption. Answers "who actually opened
  -- it" without new infra — the question this incident could not answer.
  ADD COLUMN IF NOT EXISTS consumed_ip TEXT;

COMMENT ON COLUMN impersonation_log.token_hash IS
  'SHA-256 of the opaque handoff token. The raw token lives only in the admin''s URL; no credential is stored at rest.';
COMMENT ON COLUMN impersonation_log.consumed_at IS
  'Set once, by the atomic conditional UPDATE in /api/impersonate/consume. NULL = generated but never used.';

-- Single-use is enforced by the conditional UPDATE; this index makes the
-- lookup a point read and makes a duplicate token impossible at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_impersonation_log_token_hash
  ON impersonation_log (token_hash) WHERE token_hash IS NOT NULL;
