-- System events table for observability (append-only log)
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  partnership_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying latest events by type
CREATE INDEX IF NOT EXISTS idx_system_events_type_created
  ON system_events (event_type, created_at DESC);
