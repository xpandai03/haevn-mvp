-- 045_network_snapshots_and_composition.sql
-- =============================================================================
-- NETWORK PERFORMANCE DASHBOARD — data foundation (ADDITIVE, reversible)
-- =============================================================================
-- Adds:
--   1. network_snapshots — weekly point-in-time metric history. WoW deltas are
--      unbackfillable (computed_matches is destructively rewritten every Monday),
--      so this table is the ONLY source of week-over-week trend data. One row per
--      (week-ending Saturday, market); a NULL market_name row = network-wide.
--   2. get_composition_breakdown(p_market) — one RPC that returns grouped counts
--      for all four composition charts (gender / orientation / relationship
--      intent / age) parsed from user_survey_responses.answers_json, scoped by
--      the same city->market join the release gate uses.
--
-- REVERSIBLE: DROP TABLE network_snapshots; DROP FUNCTION get_composition_breakdown(text);
-- No existing table, row, or function is modified.
-- =============================================================================

-- ── 1. Weekly snapshot history ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS network_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The week-ending Saturday (UTC) this snapshot covers. See lib/metrics/reportingWeek.ts.
  snapshot_date DATE NOT NULL,
  -- NULL = network-wide row. Non-null = markets.market_name for a per-market row.
  market_name   TEXT,
  -- Full metrics payload (SnapshotPayload in lib/metrics/types.ts). JSONB so new
  -- metrics need no migration.
  metrics       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE network_snapshots IS
  'Weekly point-in-time metric history for the Network dashboard. One row per (snapshot_date, market_name); NULL market_name = network-wide. Source of all week-over-week deltas (unbackfillable elsewhere).';

-- Upsert key. NULLS NOT DISTINCT (PG15+) so the network row (market_name IS NULL)
-- is unique and re-runnable within a week rather than duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS ux_network_snapshots_date_market
  ON network_snapshots (snapshot_date, market_name) NULLS NOT DISTINCT;

ALTER TABLE network_snapshots ENABLE ROW LEVEL SECURITY;
-- No broad policies: written/read only by service-role server code (crons +
-- admin routes), matching the ready_to_meet_signals convention.

-- ── 2. Composition breakdown RPC ─────────────────────────────────────────────
-- Mirrors the release-gate city->market join (lib/markets/releaseGate.ts) in SQL.
-- p_market IS NULL => network-wide. Fail-open would leak pre-launch cities into a
-- market scope, so an unresolved city simply never matches a non-null p_market.
--
-- Value shapes are from live prod (2026-07): q2/q3 are single coded strings with
-- casing drift (lowercased here); q9 is an array of coded strings (unnested);
-- q1_age is an ISO birthdate string. Non-conforming shapes fall into 'unknown',
-- never dropped.
CREATE OR REPLACE FUNCTION get_composition_breakdown(p_market text DEFAULT NULL)
RETURNS TABLE(dimension text, bucket text, count int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH scoped_partnerships AS (
  SELECT p.id
  FROM partnerships p
  WHERE p_market IS NULL
     OR EXISTS (
       SELECT 1
       FROM msa_allowed_zips z
       WHERE LOWER(z.city) = LOWER(p.city)
         AND z.msa_name = p_market
     )
),
scoped_users AS (
  SELECT DISTINCT pm.user_id
  FROM partnership_members pm
  JOIN scoped_partnerships sp ON sp.id = pm.partnership_id
),
answers AS (
  SELECT u.answers_json AS a
  FROM user_survey_responses u
  JOIN scoped_users su ON su.user_id = u.user_id
  WHERE u.answers_json IS NOT NULL
),
gender AS (
  SELECT 'gender'::text AS dimension,
         COALESCE(NULLIF(LOWER(TRIM(a->>'q2_gender_identity')), ''), 'unknown') AS bucket
  FROM answers
  WHERE jsonb_typeof(a->'q2_gender_identity') = 'string'
  UNION ALL
  SELECT 'gender', 'unknown'
  FROM answers
  WHERE (a ? 'q2_gender_identity') AND jsonb_typeof(a->'q2_gender_identity') <> 'string'
),
orientation AS (
  SELECT 'orientation'::text AS dimension,
         COALESCE(NULLIF(LOWER(TRIM(a->>'q3_sexual_orientation')), ''), 'unknown') AS bucket
  FROM answers
  WHERE jsonb_typeof(a->'q3_sexual_orientation') = 'string'
  UNION ALL
  SELECT 'orientation', 'unknown'
  FROM answers
  WHERE (a ? 'q3_sexual_orientation') AND jsonb_typeof(a->'q3_sexual_orientation') <> 'string'
),
-- Multi-select. Unnest the array; counts here intentionally do NOT sum to the
-- member total. Defensive: also accept a lone string encoding.
intent AS (
  SELECT 'relationship_intent'::text AS dimension,
         COALESCE(NULLIF(LOWER(TRIM(elem)), ''), 'unknown') AS bucket
  FROM answers
  CROSS JOIN LATERAL jsonb_array_elements_text(a->'q9_intentions') AS elem
  WHERE jsonb_typeof(a->'q9_intentions') = 'array'
  UNION ALL
  SELECT 'relationship_intent',
         COALESCE(NULLIF(LOWER(TRIM(a->>'q9_intentions')), ''), 'unknown')
  FROM answers
  WHERE jsonb_typeof(a->'q9_intentions') = 'string'
),
age_calc AS (
  SELECT CASE
           WHEN jsonb_typeof(a->'q1_age') = 'string'
                AND (a->>'q1_age') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           THEN EXTRACT(YEAR FROM age(CURRENT_DATE, (a->>'q1_age')::date))::int
           ELSE NULL
         END AS yrs
  FROM answers
),
age AS (
  SELECT 'age'::text AS dimension,
         CASE
           WHEN yrs IS NULL OR yrs < 18 THEN 'unknown'
           WHEN yrs BETWEEN 18 AND 24 THEN '18-24'
           WHEN yrs BETWEEN 25 AND 34 THEN '25-34'
           WHEN yrs BETWEEN 35 AND 44 THEN '35-44'
           WHEN yrs BETWEEN 45 AND 54 THEN '45-54'
           ELSE '55+'
         END AS bucket
  FROM age_calc
),
unioned AS (
  SELECT * FROM gender
  UNION ALL SELECT * FROM orientation
  UNION ALL SELECT * FROM intent
  UNION ALL SELECT * FROM age
)
SELECT dimension, bucket, COUNT(*)::int AS count
FROM unioned
GROUP BY dimension, bucket
ORDER BY dimension, count DESC, bucket;
$$;

COMMENT ON FUNCTION get_composition_breakdown(text) IS
  'Grouped composition counts (gender/orientation/relationship_intent/age) from survey answers_json, scoped by city->market join. p_market NULL = network-wide. Aggregate counts only, no PII.';

-- Aggregate counts only, but SECURITY DEFINER reads all survey rows — keep it to
-- server-side service-role callers, not arbitrary authenticated users.
REVOKE ALL ON FUNCTION get_composition_breakdown(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_composition_breakdown(text) TO service_role;
