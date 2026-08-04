-- 051_email_suppressions.sql
-- =============================================================================
-- Email suppression list — deliverability + compliance for the notification
-- stack (Resend). Keyed on the EMAIL ADDRESS (bounces/complaints/unsubs are
-- about addresses, not partnerships). One row per address; reasons escalate to
-- the STRONGER scope via upsert; rows are NEVER auto-removed.
--
-- scope semantics:
--   renotify         → blocks the recurring re-notification email only
--   all_noncritical  → blocks re-notify AND connection_interest nudges;
--                      NEVER magic-link sign-in or first-match notifications
--
-- Service-role only (RLS on, no policies) — written by the Resend webhook and
-- the unsubscribe endpoint, read by the send path + audience build.
-- ADDITIVE / reversible: DROP TABLE email_suppressions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_suppressions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,               -- ALWAYS stored lowercased
  reason      TEXT NOT NULL CHECK (reason IN ('hard_bounce','complaint','unsubscribe')),
  scope       TEXT NOT NULL CHECK (scope IN ('renotify','all_noncritical')),
  source      TEXT NOT NULL CHECK (source IN ('resend_webhook','unsub_link')),
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions (lower(email));

COMMENT ON TABLE email_suppressions IS
  'Per-address email suppression. scope renotify (bounce/unsub) blocks recurring re-notify; all_noncritical (complaint) also blocks connection_interest nudges. Never blocks magic-link or first-match. Escalate-only via upsert; never auto-removed.';

ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
