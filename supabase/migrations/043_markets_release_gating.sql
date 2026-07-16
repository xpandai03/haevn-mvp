-- 043_markets_release_gating.sql
-- =============================================================================
-- CITY-BASED RELEASE GATING — market model (single source of truth)
-- =============================================================================
-- WHY: match release/notify currently goes network-wide. Users are being loaded
-- for cities that have NOT launched (Tampa ~90 days out, Portland building). A
-- Match Monday could match/notify a pre-launch user — user-facing and hard to
-- undo. This adds the market model that gates RELEASE + NOTIFY (never
-- computation, never scoring).
--
-- MODEL:
--   partnerships.city  ->  msa_allowed_zips.city  ->  msa_name  ->  markets.is_live
--
--   We join on CITY, not zip: partnerships.zip_code is ~97% NULL, so the zip
--   path is unusable for gating members. msa_allowed_zips already carries a
--   curated city list per msa_name (the client's own Austin–Round Rock MSA
--   boundary, 24 cities), which makes it the natural city->market lookup.
--
-- FAIL CLOSED: a city that resolves to no market is NOT released/notified.
-- Under-releasing is safe; matching a pre-launch user is not.
--
-- REVERSIBLE: this is additive — a table plus a boolean. Flip is_live to
-- change behavior. No data is deleted or rewritten. Dropping this table
-- restores prior (ungated) behavior.
--
-- NOTE: msa_name contains an EN-DASH (U+2013), not a hyphen. We never hardcode
-- the literal — markets is seeded straight from msa_allowed_zips, and the
-- Austin row is matched by pattern, so the exact string can't drift.
-- =============================================================================

CREATE TABLE IF NOT EXISTS markets (
  market_name TEXT PRIMARY KEY,
  is_live     BOOLEAN NOT NULL DEFAULT false,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  markets IS
  'Single source of truth for market launch status. Gates match RELEASE + NOTIFY only — never computation or scoring. Consumed by the release/notify crons, the member read path, and (later) the Network dashboard city scope.';
COMMENT ON COLUMN markets.market_name IS
  'Matches msa_allowed_zips.msa_name exactly. Seeded from that table so the string cannot drift.';
COMMENT ON COLUMN markets.is_live IS
  'TRUE = members in this market are eligible for match release + notification. FALSE (default) = computed but never released/notified. Unresolved city -> no market -> excluded (fail closed).';

-- Seed every known market from the existing MSA lookup (exact strings, no
-- hardcoded literals). Not-live by default — launching a market is an explicit
-- act, never an accident of seeding.
INSERT INTO markets (market_name, is_live, notes)
SELECT DISTINCT z.msa_name, false, 'Auto-seeded from msa_allowed_zips'
FROM msa_allowed_zips z
ON CONFLICT (market_name) DO NOTHING;

-- Austin is the only LIVE market today. Matched by pattern to sidestep the
-- en-dash. Portland / Tampa / everything else stay false until explicitly
-- flipped by an admin.
UPDATE markets
SET is_live = true,
    notes   = 'Live market — Austin metro (client-defined Austin–Round Rock MSA boundary)',
    updated_at = NOW()
WHERE market_name ILIKE 'Austin%Round Rock%';

-- Keep updated_at honest.
-- Self-contained on purpose: update_updated_at() is declared in 001_init.sql,
-- but 001 was evidently never fully applied to this database (city_status, also
-- from 001, is absent). Rather than depend on it and have this migration fail
-- mid-way, we CREATE OR REPLACE it here. The body is identical to 001/008, so
-- this is a no-op where it already exists and a fix where it doesn't.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_markets_updated_at ON markets;
CREATE TRIGGER update_markets_updated_at
  BEFORE UPDATE ON markets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Fast city -> market resolution (the gate runs on every release/notify/read).
CREATE INDEX IF NOT EXISTS idx_msa_allowed_zips_city_lower
  ON msa_allowed_zips (LOWER(city));
