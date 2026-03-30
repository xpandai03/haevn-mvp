-- Migration 035: SMS notification support
-- Adds phone to partnerships and notification tracking to computed_matches

ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE computed_matches ADD COLUMN IF NOT EXISTS sms_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_computed_matches_sms
ON computed_matches (release_at)
WHERE sms_notified_at IS NULL;
