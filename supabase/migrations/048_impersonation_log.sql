-- 048_impersonation_log.sql
-- =============================================================================
-- IMPERSONATION AUDIT LOG — the record for the admin "sign in as user" side-door
-- =============================================================================
-- One append-only row per impersonation-link generation: WHO (admin_email) got a
-- sign-in link for WHOM (target_user_id), WHY (reason), and WHEN. Written BEFORE
-- the link is generated, so the audit trail can never be behind the action.
--
-- This is the highest-privilege action in the product; the log is the guarantee.
-- NEVER stores the generated link. Service-role only (RLS on, no policies).
--
-- ADDITIVE / reversible: DROP TABLE impersonation_log. No existing object touched.
-- =============================================================================

CREATE TABLE IF NOT EXISTS impersonation_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The allowlisted admin who generated the sign-in link.
  admin_email    TEXT NOT NULL,
  -- The user whose account was accessed.
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Required stated purpose (trust/safety review, CTA review, etc.).
  reason         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE impersonation_log IS
  'Append-only audit of admin account impersonation (magic-link generation). Row written before the link. Never stores the link itself.';

CREATE INDEX IF NOT EXISTS idx_impersonation_log_created ON impersonation_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_log_target ON impersonation_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_log_admin ON impersonation_log (admin_email);

ALTER TABLE impersonation_log ENABLE ROW LEVEL SECURITY;
-- No policies: written/read only by service-role server code (the impersonate route).
