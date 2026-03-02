-- Phase 1: Match Monday (release_at) + 90-day expiration (expires_at) columns
-- Adds to computed_matches table for batched visibility and auto-expiry

ALTER TABLE computed_matches ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ;
ALTER TABLE computed_matches ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill existing rows so they're immediately visible
UPDATE computed_matches SET release_at = computed_at WHERE release_at IS NULL;
-- Backfill existing rows: expire 90 days from when they were computed
UPDATE computed_matches SET expires_at = computed_at + INTERVAL '90 days' WHERE expires_at IS NULL;

-- Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_computed_matches_release ON computed_matches(partnership_a, release_at);
CREATE INDEX IF NOT EXISTS idx_computed_matches_expires ON computed_matches(expires_at);
