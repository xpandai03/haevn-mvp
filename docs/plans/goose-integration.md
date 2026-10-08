# Plan — Goose integration: event-cohort compatibility API (v1)

**Status:** contract v1.0 LOCKED (2026-10-07). PR 1 (cohort, compute, coverage, serializer,
alerts, backstop cron, QA harness) built against it. PR 2 (routes + auth) next. **Where the locked
contract differs from the proposal below, the contract governs. See §0.**
**Sources:** *Goose V1 — HAEVN Proper / Raunek Technical Specification* (the HAEVN-side
handoff) and its companion *Goose V1 — Emergent Build Specification*. Both say that
endpoints, payloads, retry values and recipients are **implementation details to agree with
Emergent**. This plan proposes them. Section 10 lists every place where it fills a gap the
spec leaves open, and every place where it departs from the integration-contract draft. That
draft was **not available** during recon; see §10, D1.

**What HAEVN owns:** compatibility cohorts, member association, recognising the frozen
population, all-pairs compatibility, Goose-safe results, completeness/readiness, and retry
plus alerting on failure.
**What HAEVN does not own:** events, producers, Goose numbers, eligibility or freeze
decisions, billing, guest auth, rendering, Goose purge, and any new matching logic or AI copy.

**Guiding rule (same as the recompute fix):** matching output is sacred. The cohort run
reuses the engine as it is. It changes *which population* is scored and *where results are
written*, never *how* a pair is scored.

---

## 0. Contract v1.0: rulings and what changed vs this proposal

The contract is the source of truth for PR 2's HTTP shapes. The proposal sections below are
kept for their reasoning.

**Rulings on the open questions**

- **Q1:** the approved band copy now exists. It is transcribed verbatim in
  `lib/goose/gooseBandCopy.ts` and pinned by a sha256 test.
  - It has its own event-neutral vocabulary ("Meaningful Differences", "A LONG-SHOT MATCH",
    …), separate from the member-app `sectionMapping.ts` labels.
  - It has no special "Fully Aligned" case at 100.
- **Q2:** hard-gated pairs return `compatibility_pct: 0` with the 0–59 copy. There is no floor
  and nothing is omitted.
- **Q3:** association accepts `{member_email}` or `{member_id}`. Email resolution matches
  members of **any** role, so a couple's second partner resolves too.
- **Q4:** `member_id = partnerships.id`, and **a couple shares one member_id**. This is what
  PR 2's idempotency must preserve:
  - Two guests who resolve to the same member_id produce **one** association row, because the
    primary key is (cohort, member).
  - Re-association returns the same success.
  - Finalize dedupes ids, so a couple listed twice counts as one member. It never inflates
    N(N−1)/2 and never creates a self-pair.
- **Q5** (applied): `matching_excluded` is not applied inside a cohort.
- **Q8 / Q10 / Q11** (applied):
  - The "finalize never received" watchdog is **not** built. The contract makes the freeze
    the partner's.
  - Results retention is deferred to the closeout conversation.
  - Re-finalize is allowed with no event-start restriction (contract: "re-finalizing replaces
    the prior population").
- **Q6:** superseded. Photos ARE in the contract: `photo_url_a/b`, nullable. The value is the
  primary photo, or failing that the earliest-uploaded **public, non-NSFW** photo.
- **Q7:** bearer token per contract (PR 2).
- **Q9:** assume Pro. The 5-minute backstop ships behind `GOOSE_BACKSTOP_ENABLED`.
- **Q12:** `GOOSE_ALERT_EMAILS` env.

**Proposal → contract changes**

- **Results before ready:** the contract returns the **partial set with the status echoed**.
  This proposal had a `409`. The partial rows are still current-finalization, in-population
  pairs only.
- **Status shape:** `{status, expected_pairs, completed_pairs, finalized_at, ready_at}`. There
  is no `goose_state`, `population_hash` or error detail on the wire. `population_hash` is
  still stored on the cohort.
- **Result shape:** `{member_id_a, member_id_b, compatibility_pct, classification, headline,
  considerations, photo_url_a, photo_url_b}`. `considerations` is one static string per band,
  not the per-section array proposed in §4.2.
- **Storage:** `goose_pair_results` stores `score`, `band` and `gated` only. Copy is applied at
  serialization, so no copy text lives in the table.
- **Stale-row guard:** results carry `finalization_id` rather than a per-run id. A re-finalize
  starts a new finalization, and coverage counts only the current one. Retries within one
  finalization overwrite in place.
- **Finalize** is an atomic SQL function (`goose_finalize_cohort`): population swap + wipe +
  new finalization in one transaction.
- **Contract gaps PR 2 must flag rather than invent:**
  - the response for finalize with unknown member ids
  - the response for an unknown `haevn_cohort_id` on any endpoint

  Internally, both return typed errors (`unknown_members`, `cohort_not_found`).

---

## 1. Engine reuse

### 1.1 How the weekly run scopes its population today

| Step | Where | Population rule |
|---|---|---|
| Base load | `buildRecomputeContext` (`lib/services/computeMatches.ts:165`) | `partnerships.profile_state = 'live'`. The enum is `draft \| pending \| live`. There is **no "paused" state** in the schema. |
| Matching exclusion | branch `fix/signup-location-gate-underwriting`, **not on main** | Adds `.eq('matching_excluded', false)` to the same query (migration 061, unmerged) |
| Survey choice | `computeMatchesForPartnership` L411–424, L638–645 | First member survey with `completion_pct >= 100 && answers_json` |
| Couple flag | L450, L654 | `profile_type === 'couple'` |
| Location | L444–449, L656–662 | Injects `_latitude/_longitude`. These feed only `checkDistanceConstraint`, which is **demoted and not called** by `checkConstraints`. Distance is scored softly from Q19a/b/c *preferences* (`lifestyle.ts scoreDistance`). |
| Handshake exclusion | L582–597, L625 | Skips any pair with an existing handshake |
| Scoring | `calculateCompatibilityFromRaw(a, b, aCouple, bCouple)` | 8 hard gates, then 5 categories |
| Storage floor | `STORE_MIN_SCORE = 77` (L36, L689) | Drops every pair below 77 |
| Write | upsert `computed_matches` on `(partnership_a, partnership_b)`, both directions | `release_at = getNextMonday()` |
| Release | cron `recompute-matches` | Market gate (`getReleaseEligibility`) pulls released rows forward to today. Then `match_history` capture, then notify at 14:00 and re-notify at 16:00. |

**The cross-market gate affects release only, not compute.** The engine already scores a
Portland × Austin pair on its merits. Lat/long fill is ~0%, and it would not gate even if
filled.

### 1.2 Cohort compute: what applies and what is bypassed

An event cohort is its own universe. Rule by rule:

| Weekly behaviour | Cohort run | Why |
|---|---|---|
| `profile_state = 'live'` filter | **Bypass.** The population is exactly the finalized `member_id` list. | Emergent owns eligibility. HAEVN must score what was frozen. |
| Market / city release gate | **Bypass** (it is release-only anyway) | Portland and Austin guests at one event get a real score |
| `matching_excluded` (mig 061) | **Bypass.** See Q5. | The flag keeps operator accounts out of the *member pool*. Cohort results never reach that pool, and operator accounts are useful for Goose QA. |
| Handshake exclusion | **Bypass** | Two members who already connected still need a score at the event |
| `STORE_MIN_SCORE = 77` floor | **Bypass.** Store every score, 0–100. | Spec §4: 84, 62 and 38 must all be available |
| Survey selection (first completed member survey) | **Keep, byte-identical** | Parity |
| Couple flag | **Keep** | Parity |
| `_latitude/_longitude` injection | **Keep, for parity** (it has no scoring effect today) | Parity. Same inputs mean the same score. |
| 8 hard gates | **Keep.** This is matching logic. | No new matching logic. Gated pairs score **0**; see §4.3 and Q2. |
| Write to `computed_matches` / release / history / notify | **Never** | See §1.3 |

### 1.3 What a cohort run must never do

- Never write `computed_matches`. Monday's recompute releases rows written since the run
  started, so any cohort row there would be **released and notified**.
- Never write `match_history`, `match_compute_runs`, `match_interpretations`,
  `renotify_log`, or the notify markers (`sms_notified_at` etc.).
- Never emit `match_compute`, `match_recompute*` or `console_recompute_snapshot` events.
  Those feed system-status and the admin console. Cohort runs emit `goose_*` events only.
- Never call OpenAI. No interpretation warming.
- Never call `computeMatchesForPartnership` / `recomputeAllMatches`. Those are the
  weekly-path functions, and both write `computed_matches`.

Cohort pair results live in their **own table, `goose_pair_results`** (§2).

### 1.4 Cleanest reuse path

New module `lib/goose/compute.ts`. It must **not** carry `'use server'`, because that file
exports non-async helpers. This is the build-only rule that broke prod on 2026-09-10.

1. `loadCohortInputs(admin, memberIds)` reads partnerships, `partnership_members` and
   `user_survey_responses` for the cohort only. It uses the same **chunked `.in()` (150)**
   as `buildRecomputeContext`, the same columns, and the same "first completed survey"
   selection. It returns `Map<memberId, { raw: RawAnswers | null, isCouple }>` and builds
   `raw` exactly as the weekly path does (answers plus the lat/long spread).
2. `scorePair(a, b)` is a thin call to `calculateCompatibilityFromRaw(a.raw, b.raw,
   a.isCouple, b.isCouple)`, pure and unmodified.
3. `computeCohort(cohortId)` loops `i < j` over the sorted member ids. Canonical order
   `member_a < member_b` gives exactly N(N−1)/2 rows. It maps each pair (§4), then upserts
   in chunks of 500.

**`computeMatches.ts` is not modified.** The weekly path carries the most risk in the repo,
and this integration does not need to touch it. The cost is a few duplicated lines of input
construction. A **parity test** covers that (§9). It scores overlapping pairs through both
paths and asserts identical `overallScore`/`tier`/`categories`.

**Symmetry:** the weekly path scores each pair twice, once from each side, and the last
write wins. A synthetic benchmark (§5) found **0 asymmetric scores in 2,000 gate-passing
pairs**, so a single canonical-order score per pair is safe. PR 1 asserts this again against
real cohort inputs (read-only).

---

## 2. Schema (additive migration)

> **Built version:** `supabase/migrations/062_goose_cohorts.sql` is authoritative. The draft below predates contract v1.0 (see §0).

**Number:** `062_goose_cohorts.sql`. origin/main ends at 060, and 061 is reserved by the
unmerged `matching_excluded` branch. Renumber at build time if that changes.

```sql
-- 062_goose_cohorts.sql
-- Goose event-cohort compatibility. Additive: three new tables + one read function.
-- Service-role only (RLS on, no policies). Nothing existing is altered.
-- FKs to partnerships CASCADE so member account deletion (059) is never blocked.

create table if not exists public.goose_cohorts (
  id                     uuid primary key default gen_random_uuid(),
  goose_event_id         text not null unique,            -- Emergent's id; the idempotency key
  event_name             text,
  event_starts_at        timestamptz not null,            -- absolute instant (client sends offset)
  event_timezone         text,                            -- IANA, informational
  status                 text not null default 'open'
                         check (status in ('open','finalized','computing','ready','error')),
  finalized_at           timestamptz,                     -- when HAEVN accepted the population
  population_hash        text,                            -- sha256 of sorted finalized member ids
  finalized_member_count int,
  expected_pairs         int,
  completed_pairs        int,
  current_run_id         uuid,                            -- results from older runs never count
  engine_version         text,
  compute_attempts       int not null default 0,
  compute_lease_until    timestamptz,                     -- single-flight guard
  next_retry_at          timestamptz,
  last_error_code        text,                            -- closed set, see §7
  last_error_at          timestamptz,
  alerted_at             timestamptz,                     -- first alert of the current failure episode
  ready_at               timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.goose_cohort_members (
  cohort_id     uuid not null references public.goose_cohorts(id) on delete cascade,
  member_id     uuid not null references public.partnerships(id) on delete cascade,
  associated_at timestamptz not null default now(),
  finalized     boolean not null default false,             -- true = in the frozen population
  primary key (cohort_id, member_id)                        -- idempotent association
);
create index if not exists goose_cohort_members_finalized_idx
  on public.goose_cohort_members (cohort_id) where finalized;

create table if not exists public.goose_pair_results (
  cohort_id      uuid not null references public.goose_cohorts(id) on delete cascade,
  member_a       uuid not null references public.partnerships(id) on delete cascade,
  member_b       uuid not null references public.partnerships(id) on delete cascade,
  run_id         uuid not null,
  score          smallint not null check (score between 0 and 100),
  band           text not null check (band in
                 ('exceptional','strong','compatible','some_differences','meaningful_difference')),
  classification text not null,                             -- band label (§4)
  headline       text not null,                             -- overall badge (§4)
  considerations jsonb not null,                            -- 5 section rows (§4)
  gated          boolean not null default false,            -- internal only, never serialized (Q2)
  engine_version text not null,
  computed_at    timestamptz not null default now(),
  primary key (cohort_id, member_a, member_b),              -- no duplicate pairs
  check (member_a < member_b)                               -- no mirrored duplicates, no self-pairs
);

-- Coverage = pairs of the CURRENT run whose BOTH members are in the frozen set.
-- PK + CHECK make rows distinct unordered pairs. So completed = expected holds
-- exactly when every required pair is present. Extraneous rows (old run, members
-- dropped from the population) are excluded by construction, which satisfies spec §6.
create or replace function public.goose_cohort_coverage(p_cohort uuid)
returns table (finalized_members int, expected_pairs int, completed_pairs int)
language sql stable security definer set search_path = public as $$
  with m as (
    select member_id from goose_cohort_members where cohort_id = p_cohort and finalized
  ), c as (select current_run_id from goose_cohorts where id = p_cohort)
  select
    (select count(*) from m)::int,
    ((select count(*) from m) * ((select count(*) from m) - 1) / 2)::int,
    (select count(*) from goose_pair_results r, c
      where r.cohort_id = p_cohort and r.run_id = c.current_run_id
        and r.member_a in (select member_id from m)
        and r.member_b in (select member_id from m))::int
$$;
revoke all on function public.goose_cohort_coverage(uuid) from public, anon, authenticated;

alter table public.goose_cohorts        enable row level security;
alter table public.goose_cohort_members enable row level security;
alter table public.goose_pair_results   enable row level security;
```

**Run swap:** a compute writes rows under a new `run_id`. Only once coverage confirms
completeness does it set `goose_cohorts.current_run_id = run_id, status = 'ready'`, and then
it deletes the older-run rows. Readers filter on `current_run_id`, so a half-written rerun
can never show as Ready or leak mixed results.

**Account deletion:** the CASCADE FKs mean `delete_member_account()` (059) needs no change.
If a finalized member deletes their account before the event, `expected` and `completed`
shrink together and the population hash changes. Status then reports the new hash, and
Emergent sees the mismatch (§6).

---

## 3. Member identity (Member ID)

- **Member ID = `partnerships.id`.** This is already what survey ingest returns to Emergent
  as `member_id` (`app/api/ingest/survey/route.ts:475`, along with `user_id`). It is also the
  engine's unit, so no translation is needed.
- **Couples:** a couple is one partnership, so one member_id and one survey ("first
  completed member survey"). Two people from the same couple at an event resolve to the
  **same** member_id. See Q4.
- **Email → member_id:** ingest has a private `findPartnershipByEmail` that checks owners
  only. The spec has Emergent resolve the member, but Emergent only holds member_ids for
  submissions whose ingest responses it kept. See Q3, which recommends an optional `email`
  input on association.

---

## 4. Result mapping (contract fields → approved HAEVN copy)

Only the approved, deterministic, **static** vocabulary is used. There is no AI and no new
copy. Source: `lib/matches/sectionMapping.ts` on origin/main.

### 4.1 Candidates transcribed

| Source | Values |
|---|---|
| `scoreToBand(score).label` | ≥90 `Exceptional Alignment` (exactly 100 → `Fully Aligned`) · ≥80 `Strong Alignment` · ≥70 `Compatible` · ≥60 `Some Differences` · <60 `Meaningful Difference` |
| `scoreToBand(score).band` (id) | `exceptional` · `strong` · `compatible` · `some_differences` · `meaningful_difference` |
| `overallBadge(score).label` | `EXCEPTIONAL MATCH` · `STRONG MATCH` · `COMPATIBLE MATCH` · `FAIR MATCH` · `LOW MATCH` |
| `verdictForScore(score)` | `INTRODUCTION STRONGLY RECOMMENDED` · `INTRODUCTION RECOMMENDED` · `INTRODUCTION WORTH CONSIDERING` · `INTRODUCTION WITH RESERVATIONS` |
| Breakdown legend (`breakdown/page.tsx`) | `Exceptional 90–100` · `Strong 80–89` · `Compatible 70–79` · `Some Differences 60–69` · `Meaningful Difference <60` |
| Section names (`SECTIONS`) | `Goals & Expectations` · `Structure Fit` · `Emotional & Communication` · `Sexual Compatibility` · `Practical Fit`, keyed `goals_expectations` … `practical_fit` |
| Section definitions (`lib/matches/categoryCopy.ts`) | Static `whatThisMeasures` / `whyItMatters` per section, verbatim from the public match-example page |
| Sub-score `reason` strings (engine) | Threshold-picked templates, e.g. `Compatible distance preferences` / `Different communication preferences` |
| Deterministic fallbacks (`lib/matches/fallbackCopy.ts`) | Templates over section names, e.g. `You align most on … — the areas HAEVN weighs most heavily when deciding an introduction is worth making.` |

### 4.2 Proposed mapping

| Contract field | Value | Notes |
|---|---|---|
| `member_a`, `member_b` | partnership ids, `member_a < member_b` | Goose maps them to its event numbers |
| `score` | `overallScore` (int 0–100) | The engine's integer |
| `classification` | `{ band, label }` from `scoreToBand(score)` | Closed set covering 0–100. This is the approved five-band vocabulary. |
| `headline` | `overallBadge(score).label` | Closed set, valid at any score |
| `considerations` | 5 items in engine order: `{ key, name, score, band, label }` from `parseSections(breakdown)` | Static names and band labels only. `whatThisMeasures`/`whyItMatters` stay out: they are static per section, so Goose can hold them as copy (Q1). |

### 4.3 Flags: what does not exist as static copy, or misfits

1. **No per-band headline or blurb exists.** Every band carries only a *label*. Any sentence
   of "explanation" a member sees today is either AI output (`match_interpretations`, out
   of scope) or a template written in "HAEVN matched you" framing (`fallbackCopy.ts`). That
   framing is wrong for a 38% event lookup. **I did not adopt either.** If the Goose result
   screen needs a sentence, the copy has to be written and approved. See Q1.
2. **`verdictForScore` is introduction-framed.** Its own comment says "a stored pair is
   already above the engine's floor, so there is no 'do not meet' verdict". That assumption
   breaks for Goose, where every score is visible. It is not used for `headline`.
3. **`FAIR MATCH` / `LOW MATCH`** exist in code, but per the match-card notes they have not
   been through copy review at low scores. Goose will be the first surface that routinely
   shows them. Q1.
4. **Hard-gated pairs.** The engine returns `overallScore 0`, empty categories and tier
   Bronze, so the pair serializes as `0% · Meaningful Difference · LOW MATCH` with five zero
   sections. Whether that is what a guest should see is a product call. Q2.
5. **Never exposed:** `constraints.reason`. It embeds raw answers: boundaries, gender
   attraction, race preference, safer-sex and health terms (`constraints.ts:235–953`). Also
   never exposed: sub-score `reason` strings (some reveal sensitive inferences, e.g.
   `Challenging attachment pairing (avoidant/anxious)`, `Different role/kink preferences`),
   engine `tier`, `gated`, weights, and coverage. The allowlist enforces this (§6.4).
6. **Photos.** The Emergent spec's producer Introductions view shows "Photo when
   available". Photos are not among HAEVN's four approved output categories, and this plan
   does not serve them. Q6.

---

## 5. Compute budget and timing

**Measured.** Synthetic benchmark of the unmodified engine (`calculateCompatibilityFromRaw`,
local, Deno, varied synthetic answers, no prod data):

| Path | Cost per pair |
|---|---:|
| Gates pass, full 5-category score (worst case) | **~45 µs** |
| Gate-blocked (early exit) | ~20 µs |
| 47 guests → 1,081 pairs, end to end | **42 ms** |
| ~100 guests → 4,950 pairs | 142 ms |
| 150 guests → 11,175 pairs | 307 ms |

This agrees with production: the full weekly base (every live partnership × every
candidate) computes in ~10 s including all reads.

**Projected wall time for a cohort compute:**

| | 1,100 pairs (~47 guests) | 5,000 pairs (~100 guests) |
|---|---:|---:|
| Read inputs (≤1 chunk of 150 ids × 3 tables) | ~0.5–1 s | ~0.5–1 s |
| Score (45 µs worst case) | ~0.05 s | ~0.25 s |
| Map + upsert (500-row chunks) | 3 calls, ~0.5–1 s | 10 calls, ~1.5–3 s |
| Coverage check + swap | ~0.2 s | ~0.2 s |
| **Total** | **~1–3 s** | **~3–5 s** |

**One invocation fits easily** in the 300 s function limit, with ~100× headroom at 5,000
pairs. Scoring alone would hit 300 s at ~6.6 M pairs (~3,600 guests). I/O becomes the limit
long before that. **No chunked cron is needed.** The warm-interpretation chunker (budget
check plus "cache is the cursor") is the documented escalation if events ever reach
thousands of guests. The same soft-budget pattern (`elapsed > 240 s → stop, mark error,
retry resumes`) goes in as a backstop anyway, at no cost.

**Incremental option (compute as associations arrive, reconcile at finalize): not
recommended.** T-1 work is already ~1–5 s. Incremental scoring adds staleness bugs (a
member re-submits the survey between association and T-1, so the cached pair is wrong) and a
reconcile step. All of that saves seconds inside a 60-minute window. **Keep the useful part
of the idea without its risk:** association answers `survey_complete: true|false` right
away, and status reports `members_missing_survey` before finalize. That surfaces the most
likely real failure, Emergent believing a survey is complete while the ingest never landed
in HAEVN, **hours before T-1**, and it involves no compute.

**Trigger:** `POST …/finalize` validates and persists the population, sets
`status='finalized'`, returns **202**, and runs `computeCohort` in **`after()`**
(`next/server`, Next 15.5) in the same invocation (`maxDuration = 300`). A lease
(`compute_lease_until`, claimed by conditional update) keeps it single-flight against the
sweeper (§7). Ready is typically reached **seconds after T-1**.

---

## 6. API surface

### 6.1 Endpoints

The base path is `/api/goose/v1`. Emergent must call **`https://www.haevn.app`**: the apex
307-redirects and mangles POSTs, which is the Resend-webhook lesson. All routes are
`dynamic='force-dynamic'`, Node runtime, and **added to `lib/routes/routeTable.ts`** (it is
generated; the middleware 404s unknown paths and the table test fails on drift).

| # | Method + path | Body / query | Success | Idempotency |
|---|---|---|---|---|
| 1 | `POST /cohorts` | `{ goose_event_id, event_name, event_starts_at (ISO-8601 with offset), event_timezone }` | `201` on create / `200` on repeat: `{ cohort_id, goose_event_id, status }` | `goose_event_id UNIQUE`. On a repeat, insert-or-select returns the same `cohort_id`. Name/time updates are allowed only while `status='open'`; otherwise `409 cohort_finalized`. Covers spec acceptance "Cohort linkage". |
| 2 | `POST /cohorts/{cohort_id}/members` | `{ member_id }` (+ optional `email`, Q3) | `200 { cohort_id, member_id, created: bool, survey_complete: bool }` | PK `(cohort_id, member_id)`, `upsert … ignoreDuplicates`. A repeat returns `created:false` and never duplicates. Covers "Repeat association". Unknown member → `404 member_not_found`. Allowed after finalize (late completers associate but are **not** finalized). |
| 3 | `POST /cohorts/{cohort_id}/finalize` | `{ member_ids: [...] }` (≤1,000, distinct) | `202 { status, population_hash, finalized_member_count, expected_pairs }` | Uses `population_hash` = sha256 of the sorted ids. Same hash as stored is a no-op that returns current status, and if status is `error` it also re-triggers compute (Emergent's manual retry lever). A different hash before `event_starts_at` replaces the population, re-flags `finalized`, and recomputes under a new run. A different hash after start → `409`. Listed ids not yet associated are associated implicitly; ids that are not partnerships → `422 unknown_members` (ids only). Covers "Final population". |
| 4 | `GET /cohorts/{cohort_id}/status` | — | `200 { status, goose_state: 'processing'\|'ready'\|'error', population_hash, finalized_member_count, expected_pairs, completed_pairs, members_missing_survey: [ids], last_error_code, compute_attempts, next_retry_at, ready_at, engine_version }` | Read-only. `goose_state` maps open/finalized/computing → processing. Ready requires `completed_pairs == expected_pairs` from `goose_cohort_coverage()`, never from a row count. Covers "Readiness". |
| 5 | `GET /cohorts/{cohort_id}/results` | `?cursor&limit≤1000`, or `?member_a&member_b` for one pair (either order) | `200 { cohort_id, population_hash, engine_version, pairs: [Result], next_cursor }` | Read-only. **`409 not_ready` unless `status='ready'`**: partial data is never served as a dataset. Pages are keyset on `(member_a, member_b)` within `current_run_id`. 5,000 pairs ≈ 2 MB, under the 4.5 MB body cap. Covers "Event lookup" (no compute at lookup) and "Score coverage" (no threshold). |

`Result` = exactly `{ member_a, member_b, score, classification: { band, label }, headline,
considerations: [{ key, name, score, band, label }] }`.

Every error has the shape `{ error: <code>, detail? }`, where `code` comes from a closed set.
No stack traces and no DB messages. A cohort id that does not exist returns `404`.

**Population verification:** Emergent computes the same sha256 over its own sorted frozen
ids and compares it to `population_hash` in the status response. This is the spec §6 answer
to "how the systems identify the finalized population".

### 6.2 Auth

- `Authorization: Bearer <GOOSE_SHARED_SECRET>`, checked with a **timing-safe compare**
  (`crypto.timingSafeEqual` with a length guard) in a new `lib/goose/auth.ts`. No such
  shared helper exists today: the cron routes use plain `!==`, and the ingest route inlines
  its HMAC check. The check **fails closed**: if the env var is unset, every call returns
  `503 not_configured` and is logged. Do not copy the hardcoded `?secret=` pattern from
  `admin/blast-matches`.
- Optional `GOOSE_SHARED_SECRET_NEXT` is accepted alongside, for zero-downtime rotation.
- A per-request HMAC (the ingest pattern, `${ts}.${rawBody}`) would be stronger than a
  static bearer token. See Q7. The bearer token is what the brief asks for.
- Env: Production-scope only, like the service-role key. Previews cannot reach the prod DB
  anyway (PR #44 guard).

### 6.3 Rate limiting and logging

- **There is no inbound rate-limit infrastructure** (only the DB-counted login-link limiter).
  This is a single authenticated server-to-server caller, so v1 relies on (a) auth, (b) hard
  payload caps (finalize ≤1,000 ids, body ≤256 KB, `limit ≤1000`), and (c) a **Vercel WAF
  rate-limit rule on `/api/goose/*`**. That is dashboard config with no code, e.g. 600
  req/min per IP. A per-guest lookup pattern stays far below that.
- **Logging:** `system_events`, metadata holding **ids and counts only**:
  - `goose_cohort_created`, `goose_member_associated`, `goose_finalized`
    (hash, count, expected)
  - `goose_compute` (run_id, pairs, duration_ms, attempt)
  - `goose_compute_failed` (code, attempt)
  - `goose_alert_sent` / `goose_alert_failed`, `goose_recovered`
  - `goose_auth_failed`: at most one row per minute (a counter in metadata), so a scanner
    cannot flood the table.

  Read endpoints (status/results) log structured console lines only, with no table writes.

### 6.4 Results can never leak beyond the approved fields

The same discipline as the Meetup feed (`findForbiddenKeys`). It is a true allowlist, not
`redactMatchCard`'s denylist:

1. **Storage is already reduced.** `goose_pair_results` has no column for answers,
   sub-scores, reasons, tier or constraints. Compute writes only the mapped fields.
2. **Explicit column select.** The results route selects named columns and never `*`.
3. **One serializer.** `toGooseResult(row)` builds a fresh object from named fields. It
   never spreads.
4. **Runtime guard.** `findForbiddenGooseKeys(payload)` walks
   payload → pairs → classification → considerations against
   `ALLOWED_{PAYLOAD,RESULT,CLASSIFICATION,CONSIDERATION}_KEYS`. A non-empty result means
   the route returns `500 serializer_violation` and logs it. The response never ships.
5. **Tests:**
   - The clean payload returns `[]`.
   - Injecting `tier`, `subScores`, `reason`, `gated`, `email` or `display_name` at each
     level is caught with its path.
   - The serialized JSON of a real computed pair contains no survey key (`q\d`, `Q\d`),
     no `reason` text, and no constraint text.
   - A gated pair's serialized form is indistinguishable in shape from a non-gated one.

---

## 7. Retry and alert

### 7.1 Where failure is detected

| Code | Detected in | Condition |
|---|---|---|
| `compute_exception` | `computeCohort` catch | Read, scoring or upsert throws |
| `members_missing_survey` | `computeCohort` precheck | A finalized member has no completed HAEVN survey, e.g. an ingest that never landed |
| `member_not_found` | precheck | A finalized id has no partnership (deleted between finalize and compute) |
| `incomplete_coverage` | post-write coverage check | `completed_pairs < expected_pairs` after a run that reported success |
| `soft_budget` | compute loop | 240 s backstop hit |
| `stalled` | sweeper | `status='computing'` with an expired lease (function killed mid-run) |
| `not_ready_near_start` | sweeper watchdog | Finalized but not ready at `event_starts_at − 30 min` |
| `finalize_not_received` (optional, Q8) | sweeper watchdog | `status='open'` at T-1 + 10 min |

### 7.2 Auto-retry

- **In-process:** inside the `after()` callback, attempts run at **0 s → +20 s → +60 s**.
  Transient DB errors usually clear here.
- **Backstop: sweeper cron `/api/cron/goose-sweeper`, every 5 min.** It picks cohorts where
  `status='error' AND next_retry_at <= now() AND event_starts_at > now()`, plus stalled
  `computing` rows. It claims each through the lease and recomputes. Backoff is
  1 → 2 → 5 → 5 → 5 min, **capped at 8 attempts or event start**, whichever comes first.
  `members_missing_survey` keeps retrying, because ingest may catch up.
- **Manual lever:** a re-POST of `finalize` with the same hash re-triggers compute when the
  status is `error`.
- **Vercel plan check (do first):** a 5-minute cron needs the Pro plan. Hobby allows only
  daily crons. If the plan is Hobby, the sweeper is dropped, and retry relies on the
  in-process attempts plus Emergent's re-finalize lever, polled from their side. Q9.

### 7.3 Immediate email, fired with the first retry

- On the **first** failure of a failure episode, i.e. when `alerted_at IS NULL`, the alert
  send and retry #1 start **together**:
  `await Promise.allSettled([sendGooseAlert(...), retryCompute(...)])`.
  The alert never waits on a retry outcome, and a failed alert never blocks the retry.
- **Path:** the existing `sendEmail` choke point (`lib/services/email.ts`), from
  `notifications@updates.haevn.co`, **`scope: 'critical'`** so suppression can never
  swallow it.
- **Recipients:** env **`GOOSE_ALERT_EMAILS`** (comma-separated, set to Rik + Raunek). The
  addresses are **not in code** because the repo is public. If unset, log
  `goose_alert_failed {reason:'unconfigured'}` and `console.error`. Nothing is silent.
- **Content:** ids, counts and the error code only. Event name, cohort id, `goose_event_id`,
  starts-at, expected vs completed, `members_missing_survey` count, attempt, and next retry.
  No member names or emails.
- **De-dup:** one alert per episode, then one **"still failing / retries exhausted"**
  follow-up, then one **"recovered — Ready"** email when it clears. Recovery resets
  `alerted_at`. No email per retry.
- Emergent's own Processing/Ready/Error monitoring keeps working from `/status`, which
  carries `last_error_code`, attempts and `next_retry_at`.

---

## 8. PR split

**PR 1 — cohort, compute, alerts (no public routes).**
- Contents:
  - migration 062
  - `lib/goose/{compute,inputs,mapping,serialize,coverage,alerts,lease}.ts`
  - the sweeper cron (+ `vercel.json`, route table)
  - `GOOSE_ALERT_EMAILS`
- Includes the allowlist serializer and `findForbiddenGooseKeys`, because compute writes
  mapped rows and the shape has to be locked where it is produced.
- Exercised with a script `scripts/goose/dry-run-cohort.ts`, run against a non-prod
  database (previews no longer share prod). It covers: create cohort → associate →
  finalize → compute → coverage → serialize, plus forced failures.
- Tests:
  - parity vs the weekly path
  - the 47 → 1,081 coverage check
  - duplicate, extraneous and old-run rows cannot satisfy readiness
  - alert fires together with retry #1 (mocked clock/sender)
  - de-dup and recovery
  - serializer leak tests
  - lease single-flight
- Ships **dark**: there are no inbound routes yet, and the sweeper no-ops on zero cohorts.

**PR 2 — API surface.**
- The five routes, `lib/goose/auth.ts`, request validation, the idempotency semantics in
  §6.1, route-table entries, and the WAF rule (a manual step in the PR body).
- Route-level tests for auth (missing, wrong and unset secret), every idempotency case, the
  `409`s, pagination, and pair lookup.
- An integration contract doc for Emergent: `docs/specs/goose-api-v1.md`, with fields,
  codes and examples.
- Ships behind `GOOSE_API_ENABLED`. When it is off, every route returns `503`.

**Why this split holds:** PR 1 is all of the correctness risk (engine reuse, readiness math,
alerting) and is testable without an external caller. PR 2 is thin and mechanical. **One
change to the brief:** move the serializer and allowlist **into PR 1** (above), not PR 2.
**One gate between the two:** do not merge PR 2 until Emergent signs off the field-level
contract (§6.1 + §4.2). The spec says the fields are to be agreed, and changing them after
Emergent builds against them costs both teams.

**Manual deploy steps (PR bodies):**
1. Apply 062.
2. Set `GOOSE_SHARED_SECRET` (Prod) and `GOOSE_ALERT_EMAILS` (Prod).
3. Confirm the Vercel plan for the 5-min cron.
4. Add the WAF rule.
5. Give Emergent the base URL (`https://www.haevn.app`) and the secret out-of-band.
6. Flip `GOOSE_API_ENABLED`.

`npm run build` must pass before each push.

---

## 9. Verification plan (for the build PRs)

- **Parity:** for a sample of real live pairs (read-only), `scorePair` must equal a fresh
  `calculateCompatibilityFromRaw` through the weekly input construction, in both orders.
  Zero divergence is the bar, as in the recompute fix.
- **Gate-rate measurement (read-only, before Q2 is decided):** the share of pairs among
  current live members that are hard-gated, broken down by gate. The synthetic data
  over-states it, so it gives no real number.
- **47 → 1,081:** synthetic cohort, assert expected = completed = 1,081, Ready.
- **Readiness adversarial cases:**
  - delete one row → not Ready
  - insert a pair with an outsider → not counted
  - a stale-run row → not counted
  - a mirrored pair → rejected by CHECK
- **Failure drill:** force `compute_exception`. The alert and retry #1 timestamps must sit
  within the same second, and recovery must send the recovered email.
- **No side effects:** after a cohort run, `computed_matches`, `match_history`,
  `match_compute_runs` and the notify columns are byte-identical (row counts plus max
  `computed_at`).

---

## 10. Contract deviations and gaps (flagged, not silently redesigned)

- **D1 — Contract draft not seen.** The brief referenced an integration-contract draft
  with five endpoints, but it was not attached. §6.1 derives the five exchanges from spec
  §8's table (cohort creation, member association, final population, results,
  completeness/status). **Reconcile these names, fields and codes against the draft before
  PR 2.** Anything here that disagrees with the draft is a proposal, not a decision.
- **D2 — The spec leaves retry and alert ownership "to be agreed across the boundary".**
  This plan puts **both on HAEVN**, because HAEVN owns compute and is the only side that can
  retry it. Emergent keeps its own state tracking from `/status` and can still alert
  independently. This needs Emergent's agreement.
- **D3 — Results are refused until Ready (`409`).** The spec allows "a status response or
  other exchange mechanism". This reading makes "partial results must not be represented as
  a fully ready event" structural.
- **D4 — Optional email on association** (Q3). The spec says *Emergent* resolves the
  member. This would add a HAEVN-side lookup.
- **D5 — HAEVN-side retention of cohort data.** The spec's purge list covers Emergent's
  data and does not address HAEVN's copy. See Q10.

---

## 11. Open questions (each with a recommended answer)

| # | Question | Recommendation |
|---|---|---|
| Q1 | The Goose result screen needs which text? Today there is **no static per-band sentence**: only band labels, the `… MATCH` badge, and introduction-framed verdicts. | Ship v1 with `classification` (band label) + `headline` (`overallBadge`) + five section rows. Give Emergent the static `categoryCopy` definitions as screen copy. If Rik wants a sentence per band, he writes five lines (one per band, framed for event lookups) and we add them as a static table. Confirm whether `FAIR MATCH` / `LOW MATCH` is approved for guests. |
| Q2 | Hard-gated pairs (e.g. no mutual attraction, a boundary conflict) score **0**. Show them as `0% · Meaningful Difference`? | Yes. Serve the engine's 0 with the normal shape and keep `gated` internal. Alternatives would be a new result category (forbidden by the spec) or scoring past the gates (new matching logic). Measure the real gate rate first (§9) so Rik decides with the number in hand. |
| Q3 | How does Emergent get the member_id for a guest who completed the survey long ago? | Let association accept `{ email }` as an alternative to `{ member_id }`. Resolve it via `profiles.email` → `partnership_members` (**any role**, not owner-only), and return the member_id or `404`. It sits behind the secret and is logged. |
| Q4 | Couples: both partners at an event share one member_id and one survey. | Accept it for v1: one member_id is one compatibility identity. Emergent decides whether both partners can share a Goose number or entry. Document it in the contract. |
| Q5 | Should `matching_excluded` (operator/test) members be refused in cohorts? | No. Bypass it, because cohort results never enter the member pool. Being able to run a Goose QA event with operator accounts is valuable. |
| Q6 | The producer Introductions view wants photos. | Out of HAEVN's approved output categories. Emergent sources photos from its own survey system. If they must come from HAEVN, that is a separately approved field. |
| Q7 | Static bearer token, or the per-request HMAC (ingest pattern)? | Bearer plus timing-safe compare plus rotation for v1, as briefed. HMAC is a cheap later upgrade, since we already run it in both directions with this partner. |
| Q8 | Alert if Emergent never sends finalize by T-1 + 10 min? | Yes, as a low-cost safety net, with the same recipients and de-dup. The freeze is Emergent's, but a silent missing finalize means no Goose at the event. |
| Q9 | Is the Vercel project on Pro (needed for the 5-min sweeper)? | Verify before PR 1. If Hobby, drop the sweeper and rely on the in-process retries plus Emergent re-finalize. |
| Q10 | How long does HAEVN keep cohort membership and pair results? Event attendance is sensitive. | Purge `goose_pair_results` and `goose_cohort_members` at `event_starts_at + 30 days` via the sweeper. Keep the `goose_cohorts` row (counts and hash only) for audit. |
| Q11 | Re-finalize with a *different* population after T-1 but before start. Allowed? | Yes, until `event_starts_at`. It recomputes in seconds. After start → `409`. |
| Q12 | Alert recipients | Rik + Raunek via `GOOSE_ALERT_EMAILS`. Confirm the exact addresses out-of-band. They do not go in the repo. |
