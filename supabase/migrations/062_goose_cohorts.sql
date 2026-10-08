-- 062_goose_cohorts.sql
-- Goose event-cohort compatibility (plan: docs/plans/goose-integration.md).
--
-- An event cohort is its own scoring universe: every unique pair of the
-- population the event partner finalizes is scored once, written HERE and
-- nowhere else. Nothing in this migration touches computed_matches, match
-- history, notifications, or any member-facing table.
--
-- Additive: three tables + two functions. Nothing existing is altered.
-- Service-role only: RLS on with no policies, functions revoked from
-- public/anon/authenticated. FKs to partnerships CASCADE so member account
-- deletion (059) is never blocked by a cohort row.

-- ── Cohorts ────────────────────────────────────────────────────────────────
create table if not exists public.goose_cohorts (
  id                  uuid primary key default gen_random_uuid(),
  goose_event_id      text not null unique,             -- partner's event id; idempotency key
  event_name          text,
  event_starts_at     timestamptz not null,
  -- open = created, not yet finalized; processing = finalized, compute pending
  -- or running; ready = every unique pair present; error = failed/incomplete.
  status              text not null default 'open'
                      check (status in ('open', 'processing', 'ready', 'error')),
  -- One id per finalization. Results carry it; only rows of the CURRENT
  -- finalization count toward coverage, so rows from a prior population can
  -- never satisfy readiness even if the wipe were to miss them.
  finalization_id     uuid,
  finalized_at        timestamptz,
  population_hash     text,                             -- sha256 of sorted finalized member ids
  expected_pairs      integer,
  completed_pairs     integer,
  ready_at            timestamptz,
  last_compute_ms     integer,                          -- wall time of the last compute attempt
  last_compute_pairs  integer,                          -- pairs written by that attempt
  compute_attempts    integer not null default 0,       -- attempts for the current finalization
  compute_lease_until timestamptz,                      -- single-flight guard
  next_retry_at       timestamptz,                      -- backstop schedule while in error
  last_error_code     text,                             -- closed set (lib/goose/types.ts)
  last_error_at       timestamptz,
  alerted_at          timestamptz,                      -- first alert of the current failure episode
  exhausted_alerted_at timestamptz,                     -- "retries stopped" alert, once
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Association + frozen population ────────────────────────────────────────
create table if not exists public.goose_cohort_members (
  cohort_id     uuid not null references public.goose_cohorts(id) on delete cascade,
  member_id     uuid not null references public.partnerships(id) on delete cascade,
  associated_at timestamptz not null default now(),
  finalized     boolean not null default false,         -- true = in the frozen population
  primary key (cohort_id, member_id)                    -- association is idempotent
);
create index if not exists goose_cohort_members_finalized_idx
  on public.goose_cohort_members (cohort_id) where finalized;

-- ── Pair results ───────────────────────────────────────────────────────────
-- One row per unordered pair: member_a < member_b makes a mirrored duplicate
-- or a self-pair unrepresentable, and the primary key makes a repeated pair
-- unrepresentable. Only score + band are stored; the approved copy is applied
-- at serialization. Gate reasons, category scores and answers have no column.
create table if not exists public.goose_pair_results (
  cohort_id       uuid not null references public.goose_cohorts(id) on delete cascade,
  member_a        uuid not null references public.partnerships(id) on delete cascade,
  member_b        uuid not null references public.partnerships(id) on delete cascade,
  finalization_id uuid not null,
  score           smallint not null check (score between 0 and 100),
  band            text not null check (band in
                  ('exceptional', 'strong', 'compatible', 'some_differences', 'meaningful_differences')),
  gated           boolean not null default false,       -- internal only; never serialized
  engine_version  text not null,
  computed_at     timestamptz not null default now(),
  primary key (cohort_id, member_a, member_b),
  check (member_a < member_b)
);

-- ── Coverage: the readiness truth ──────────────────────────────────────────
-- completed = result rows of the CURRENT finalization whose BOTH members are
-- in the finalized set. PK + CHECK make those rows distinct unordered pairs of
-- that set, so completed = expected holds exactly when every pair is present.
-- Outsider rows and rows from a prior finalization are excluded by the join.
create or replace function public.goose_cohort_coverage(p_cohort uuid)
returns table (finalized_members integer, expected_pairs integer, completed_pairs integer)
language sql stable security definer set search_path = public, pg_temp as $$
  with m as (
    select member_id from public.goose_cohort_members
    where cohort_id = p_cohort and finalized
  ), n as (select count(*)::integer as k from m)
  select
    n.k,
    (n.k * (n.k - 1) / 2)::integer,
    (select count(*)::integer from public.goose_pair_results r
       join public.goose_cohorts c on c.id = r.cohort_id
      where r.cohort_id = p_cohort
        and r.finalization_id = c.finalization_id
        and r.member_a in (select member_id from m)
        and r.member_b in (select member_id from m))
  from n
$$;

-- ── Finalize: atomic population swap ───────────────────────────────────────
-- Replaces the frozen population in ONE transaction: associates any listed id
-- not yet associated, flags exactly the listed ids as finalized, wipes every
-- prior result, and starts a fresh finalization. Raises on unknown ids so a
-- typo can never silently shrink the population.
create or replace function public.goose_finalize_cohort(
  p_cohort uuid,
  p_member_ids uuid[],
  p_population_hash text
) returns table (finalization_id uuid, expected_pairs integer)
language plpgsql security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_ids uuid[];
  v_n integer;
  v_unknown integer;
  v_fid uuid := gen_random_uuid();
begin
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_member_ids) as x;
  v_n := coalesce(array_length(v_ids, 1), 0);

  perform 1 from public.goose_cohorts where id = p_cohort for update;
  if not found then
    raise exception 'goose_cohort_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_unknown
    from unnest(v_ids) as x
   where not exists (select 1 from public.partnerships p where p.id = x);
  if v_unknown > 0 then
    raise exception 'goose_unknown_members:%', v_unknown using errcode = 'P0001';
  end if;

  insert into public.goose_cohort_members (cohort_id, member_id, finalized)
  select p_cohort, x, true from unnest(v_ids) as x
  on conflict (cohort_id, member_id) do update set finalized = true;

  update public.goose_cohort_members
     set finalized = false
   where cohort_id = p_cohort and finalized and not (member_id = any (v_ids));

  delete from public.goose_pair_results where cohort_id = p_cohort;

  update public.goose_cohorts set
    status = 'processing',
    finalization_id = v_fid,
    finalized_at = now(),
    population_hash = p_population_hash,
    expected_pairs = (v_n * (v_n - 1) / 2),
    completed_pairs = 0,
    ready_at = null,
    compute_attempts = 0,
    compute_lease_until = null,
    next_retry_at = null,
    last_error_code = null,
    last_error_at = null,
    alerted_at = null,
    exhausted_alerted_at = null,
    updated_at = now()
  where id = p_cohort;

  return query select v_fid, (v_n * (v_n - 1) / 2)::integer;
end
$$;

revoke all on function public.goose_cohort_coverage(uuid) from public, anon, authenticated;
revoke all on function public.goose_finalize_cohort(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.goose_cohort_coverage(uuid) to service_role;
grant execute on function public.goose_finalize_cohort(uuid, uuid[], text) to service_role;

alter table public.goose_cohorts        enable row level security;
alter table public.goose_cohort_members enable row level security;
alter table public.goose_pair_results   enable row level security;
