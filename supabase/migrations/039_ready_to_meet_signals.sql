-- Mutual "Ready to meet" signals between two partnerships (canonical pair ordering).
-- Accessed only via service-role / admin server code (RLS enabled, no broad policies).

CREATE TABLE IF NOT EXISTS ready_to_meet_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_smaller UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  partnership_larger UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  signaller_partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ready_to_meet_pair_order CHECK (partnership_smaller < partnership_larger),
  CONSTRAINT ready_to_meet_signaller_in_pair CHECK (
    signaller_partnership_id = partnership_smaller
    OR signaller_partnership_id = partnership_larger
  ),
  CONSTRAINT ready_to_meet_unique_signaller UNIQUE (
    partnership_smaller,
    partnership_larger,
    signaller_partnership_id
  )
);

CREATE INDEX IF NOT EXISTS idx_ready_to_meet_pair
  ON ready_to_meet_signals (partnership_smaller, partnership_larger);

COMMENT ON TABLE ready_to_meet_signals IS
  'One row per partnership that has signalled ready-to-meet for a pair; mutual = two rows for the same (smaller,larger) pair.';

ALTER TABLE ready_to_meet_signals ENABLE ROW LEVEL SECURITY;
