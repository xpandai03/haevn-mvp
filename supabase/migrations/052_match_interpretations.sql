-- 052_match_interpretations.sql
-- Cache for AI-generated match interpretations, one row per viewer→match
-- DIRECTION (A→B and B→A are distinct — the copy is written to "you" = viewer).
--
-- Freshness is validated at read time against the live computed_matches row
-- (engine_version + source_computed_at); a Monday recompute rewrites
-- computed_matches with a new computed_at, so stale interpretations are detected
-- and regenerated. We intentionally do NOT foreign-key to computed_matches.id
-- (which is wiped/rewritten weekly) — that would delete-race during the rewrite
-- window and lose rows useful for analytics.

create table if not exists public.match_interpretations (
  id uuid primary key default gen_random_uuid(),
  viewer_partnership_id uuid not null references public.partnerships(id) on delete cascade,
  match_partnership_id  uuid not null references public.partnerships(id) on delete cascade,
  engine_version text not null,
  source_computed_at timestamptz not null,
  model text not null,
  schema_version text not null default 'v1',
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  unique (viewer_partnership_id, match_partnership_id)
);

create index if not exists idx_match_interpretations_pair
  on public.match_interpretations (viewer_partnership_id, match_partnership_id);

-- Service-role only: this is written by server actions / crons via the admin
-- client and never queried directly from the browser. RLS on with no policies
-- = deny all to anon/auth; the service role bypasses RLS.
alter table public.match_interpretations enable row level security;
