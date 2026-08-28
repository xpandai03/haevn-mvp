-- 054_login_links.sql
-- =============================================================================
-- MAGIC-LINK SIGN-IN — handoff tokens + rate limiting for /auth/login
-- =============================================================================
-- Most members were imported from the marketing survey and have NO password:
-- 558 have a completed survey and have never signed in. Their only way in today
-- is a match-notification email. This table backs a self-serve "email me a
-- sign-in link" flow on the login page.
--
-- WHY A HANDOFF AND NOT A RAW MAGIC LINK (same lesson as 053/PR #27):
-- a single-use Supabase magic link mailed to a member is burned by the first
-- scanner or link-prefetcher that touches it, and the human then sees "expired".
-- Mail clients are far MORE aggressive about this than browsers. So the email
-- carries an opaque handoff token whose landing page is inert; the magic link is
-- generated server-side only on an explicit POST and lives for one redirect.
--
-- ONE ROW PER REQUEST — including requests we do not act on. An unknown email
-- and a rate-limited email both still insert a row (with token_hash NULL and
-- sent = false). That keeps the rate-limit counters honest and, more importantly,
-- makes the code path identical for every input so the response can never leak
-- whether an account exists.
--
-- NO EMAIL ADDRESSES ARE STORED. email_hash is sha256(lower(trim(email))), which
-- is enough to count per-email attempts and nothing else — so a request for an
-- address that has no account leaves no personal data behind.
--
-- ADDITIVE / reversible: new table only. Rollback: DROP TABLE login_links.
-- =============================================================================

CREATE TABLE IF NOT EXISTS login_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SHA-256 of the opaque handoff token. NULL when no link was issued (unknown
  -- email, or over the rate limit). The raw token exists only in the member's
  -- emailed URL — never here, never in a log.
  token_hash   TEXT UNIQUE,

  -- sha256(lower(trim(email))). Rate-limit key. NEVER the address itself.
  email_hash   TEXT NOT NULL,

  -- The account the link signs in, when one exists. NULL = no account matched;
  -- the row exists only so the counters and the code path stay uniform.
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- First hop of x-forwarded-for at request time. Per-IP rate-limit key.
  request_ip   TEXT,

  -- True only when an email actually went out.
  sent         BOOLEAN NOT NULL DEFAULT FALSE,

  -- Our own 15-minute TTL. Governs the member experience regardless of the
  -- project's Supabase "Email OTP Expiration", which now only has to cover the
  -- milliseconds between generateLink and the redirect.
  expires_at   TIMESTAMPTZ,

  -- Set once, by the atomic conditional UPDATE that redeems the handoff.
  consumed_at  TIMESTAMPTZ,
  consumed_ip  TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE login_links IS
  'Self-serve magic-link sign-in handoffs. One row per request (including unknown/rate-limited, which store no token). Stores a hash of the email, never the address.';

-- Rate-limit lookups: 3 per email / 15 min, 10 per IP / hour.
CREATE INDEX IF NOT EXISTS idx_login_links_email_recent ON login_links (email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_links_ip_recent    ON login_links (request_ip, created_at DESC);
-- Redemption is a point read on the token hash.
CREATE INDEX IF NOT EXISTS idx_login_links_token        ON login_links (token_hash) WHERE token_hash IS NOT NULL;

ALTER TABLE login_links ENABLE ROW LEVEL SECURITY;
-- No policies: written/read only by service-role server code (the login-link routes).
