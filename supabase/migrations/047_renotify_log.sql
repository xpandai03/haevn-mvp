-- 047_renotify_log.sql
-- =============================================================================
-- MATCH RE-NOTIFICATION audit log (also the suppression state + future dashboard source)
-- =============================================================================
-- One row per (partnership, Monday run). Records what was attempted/sent, the
-- copy variant, suppression reason, and the consecutive send_count (for the cap).
-- The UNIQUE (partnership_id, run_date) makes a same-Monday re-run idempotent — it
-- cannot double-send. Promote-only audit: rows are inserted/updated, never deleted,
-- so "who did we nag, when, and why" is always answerable.
--
-- ADDITIVE / reversible: DROP TABLE renotify_log. No existing object touched.
-- Service-role only (RLS on, no broad policies) — same convention as ready_to_meet_signals.
-- =============================================================================

CREATE TABLE IF NOT EXISTS renotify_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id     UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  -- The Monday (UTC date) of the run this row belongs to.
  run_date           DATE NOT NULL,
  -- true = dry-run (no providers called); false = a real send was attempted.
  dry_run            BOOLEAN NOT NULL DEFAULT true,
  -- 'has_phone' | 'no_phone' | NULL (when suppressed before channel resolution).
  variant            TEXT,
  -- Channels attempted this run, e.g. {sms,email} or {email}.
  channels_attempted TEXT[] NOT NULL DEFAULT '{}',
  -- Per-channel outcome: 'sent' | 'failed' | 'skipped' | NULL.
  sms_status         TEXT,
  email_status       TEXT,
  -- 'login_detected' | 'cap_reached' | NULL (null = not suppressed).
  suppressed_reason  TEXT,
  -- Count of prior real (non-dry-run) sends to this partnership, at this run.
  send_count         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE renotify_log IS
  'Per-(partnership, Monday run) audit for the match re-notification engine. UNIQUE(partnership_id, run_date) enforces idempotency. Promote-only; drives suppression cap and the (later) admin dashboard.';

-- Idempotency + upsert key.
CREATE UNIQUE INDEX IF NOT EXISTS ux_renotify_log_partnership_run
  ON renotify_log (partnership_id, run_date);

-- Fast "latest run" + cap lookups.
CREATE INDEX IF NOT EXISTS idx_renotify_log_run_date ON renotify_log (run_date DESC);
CREATE INDEX IF NOT EXISTS idx_renotify_log_partnership ON renotify_log (partnership_id);

ALTER TABLE renotify_log ENABLE ROW LEVEL SECURITY;
-- No broad policies: written/read only by service-role server code (cron + admin route).
