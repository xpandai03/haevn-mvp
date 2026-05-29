-- 040_purchases_and_membership_expiry.sql
-- Adds fixed-duration membership expiry to partnerships and a purchases
-- ledger used for Lemonsqueezy webhook idempotency + audit.

-- Expiry for time-boxed HAEVN+ access (NULL = no active paid membership / free).
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;

-- Purchases ledger: one row per fulfilled order.
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID REFERENCES partnerships(id) NOT NULL,
  user_id UUID,
  external_order_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'lemonsqueezy',
  tier TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  expires_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lookups.
CREATE INDEX IF NOT EXISTS idx_purchases_partnership ON purchases(partnership_id);
CREATE INDEX IF NOT EXISTS idx_purchases_external_order ON purchases(external_order_id);

-- RLS: the purchases ledger is written/read only by the service role
-- (Lemonsqueezy webhook). Enable RLS with no permissive policies so the
-- anon/authenticated clients cannot touch it; the service role bypasses RLS.
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
