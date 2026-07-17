# Plan — Network Performance Dashboard: data foundation

Status: implementation in `feat/network-metrics-foundation`. Backend only, no UI.
Additive migration (new table + new function) — reversible by dropping both.

## Scope
IN: one migration (`network_snapshots` table + `get_composition_breakdown` RPC),
`lib/metrics/` module (reportingWeek, scope, getMetrics, types), a snapshot cron
route + admin manual-trigger route, one `vercel.json` cron line, tests.
OUT: no UI, no mockup changes, no touching existing crons / matching / Lemonsqueezy
webhook. Plus/tier metrics deferred as `{ blocked: true }` stubs.

## Verified ground truth (read from loose SQL + live prod, do not re-derive)
- Score bands are owned by `lib/matching/scoreBands.ts` — **Matches ≥ 80**,
  **Recommendations 77–79 inclusive**. This MATCHES the mockup's 77–79; no
  discrepancy. We import the constants, never hardcode.
- `computed_matches` (DDL in loose `MATCHING_MIGRATION.sql`): partnership-keyed
  (`partnership_a`, `partnership_b`), `score` 0–100, `computed_at`. 258 rows live.
  **It is destructively rewritten every Monday** by the recompute cron → only one
  week of match history exists at a time → WoW is unbackfillable → snapshots matter.
- "Member" = `partnerships` (597 live). Surveys/gender/etc. are per-person.
- Scope join (city→market) already implemented in `lib/markets/releaseGate.ts`
  (`loadMarketIndex`, `resolveMarket`, `isCityLive`). We REUSE it (TS side) and
  mirror the same join in SQL inside the RPC. Join on `LOWER(city)`, fail closed.
- Weekly source tables & keys: `computed_matches.computed_at` (partnership-keyed);
  `ready_to_meet_signals.created_at` (`signaller_partnership_id`); `handshakes.created_at`
  (`a_partnership`/`b_partnership`); `nudges.created_at` (**user-keyed** `sender_id`);
  `conversations.created_at` (**user-keyed** `participant1_id`/`participant2_id`).
  nudges/handshakes/conversations are 0 rows — wired, zeros are honest.
- Survey values (live shapes): `q1_age` = ISO birthdate string; `q2_gender_identity`
  & `q3_sexual_orientation` = single coded strings with casing drift → `LOWER`;
  `q9_intentions` = **array** of coded strings (+ legacy full-label variants).

## Decisions (flagged for review)
1. **Timezone = UTC, not America/Chicago.** Spec said Chicago but instructed to
   match the app's existing handling; the whole app is UTC (`getNextMondayUTC`,
   `getNextMonday`, all cron schedules) and no tz lib is installed. Per "consistency
   beats correctness," reporting weeks use UTC boundaries. `date-fns-tz` is NOT
   installed; not adding it. → If product truly needs Austin-local weeks, that's a
   follow-up that also moves the existing crons.
2. **Reporting week = Sunday 00:00:00.000 → Saturday 23:59:59.999 UTC** (Rik's spec).
   `snapshot_date` = the week-ending Saturday.
3. **Cron timing = Saturday 23:00 UTC (`0 23 * * 6`), NOT Monday 13:00.** Reason:
   the recompute cron destructively rewrites `computed_matches` every Monday 12:00
   UTC; a Monday snapshot would read post-recompute state and misattribute the week.
   Saturday-late captures the week at its end, before the Monday rewrite. (Spec
   invited "Sunday late" — but with a Sun–Sat week the end-of-week is Saturday, so
   Saturday-late is the faithful version of that instruction.) Both cron and the
   manual trigger snapshot `currentReportingWeek(now)`, so the first manual run drops
   this week's row immediately and the Saturday cron upserts it to final numbers.
4. **`neverMatched` → field named `noCurrentMatch`.** Implemented as "absent from
   `computed_matches`". True lifetime-never is unknowable without match-history
   retention (see decision above). Named honestly, commented.
5. **Surveys counted at person level** (`profiles.survey_complete`) for v1 with an
   `// OPEN QUESTION` note (boolean col vs `completion_pct`-derived can disagree:
   live shows survey_complete=true 96). Scoped to a market via partnership_members.

## Migration DDL (`supabase/migrations/045_network_snapshots_and_composition.sql`)
- `network_snapshots(id uuid pk, snapshot_date date, market_name text NULL,
  metrics jsonb, created_at timestamptz)`, `UNIQUE (snapshot_date, market_name)
  NULLS NOT DISTINCT` (Postgres 15+) so `market_name IS NULL` (network row) upserts
  cleanly. `market_name IS NULL` = network-wide row; non-null = per-market row.
- `get_composition_breakdown(p_market text DEFAULT NULL) RETURNS TABLE(dimension text,
  bucket text, count int)`, `SECURITY DEFINER`. Scopes partnerships by the same
  city→market join (`p_market IS NULL` = network). Emits `gender` (q2, lower),
  `orientation` (q3, lower), `relationship_intent` (q9, unnest array, lower — counts
  won't sum to total, by design), `age` (q1 birthdate → 18-24/25-34/35-44/45-54/55+,
  unparseable/missing → `unknown`). Defensive `jsonb_typeof` guards; nothing dropped
  silently.

## Type contract (`lib/metrics/types.ts`) — the UI phase builds against this
`Scope = 'network' | { market: string }`; `MetricsResult { scope, scopeLabel, week,
partnershipsInScope, snapshot, weekly, generatedAt }`; blocked metrics as
`{ blocked: true, reason }`; `Composition { gender, orientation, relationshipIntent,
age: CompositionBucket[] }`, `CompositionBucket { dimension, bucket, count }`.

## Files
- `lib/metrics/reportingWeek.ts` — UTC Sun–Sat week model (only place with date math).
- `lib/metrics/scope.ts` — `resolvePartnershipScope(scope)` reusing releaseGate index.
- `lib/metrics/getMetrics.ts` — `getMetrics({scope,week})`, `getComposition({scope})`.
- `lib/metrics/runSnapshot.ts` — shared: getMetrics+getComposition → upsert row(s).
- `app/api/cron/snapshot-network/route.ts` — `CRON_SECRET` Bearer gate (matches
  existing crons; never the hardcoded-secret pattern).
- `app/api/admin/snapshot-network/route.ts` — `isAdminUser` gate, POST fires runSnapshot.
- `vercel.json` — add `{ "path": "/api/cron/snapshot-network", "schedule": "0 23 * * 6" }`.
- Tests (`npx tsx`, repo convention, no new deps): reportingWeek boundaries/rollover,
  scope resolution (known/unknown/cased city, fail-closed), band split boundaries,
  composition bucket logic (age brackets, array intents, casing, unknown).

## Release steps (gated — off-hours, via PR/pipeline; NOT done in this session)
Friday-evening Austin is not an off-hours window and there is no direct DDL path
from this workspace (no PG URL; CLI needs the DB password). So:
1. Merge PR. 2. Apply migration 045 (Supabase CLI / dashboard). 3. Deploy (activates
the Saturday cron). 4. Fire the manual trigger once to seed **this week's** row now.
Everything read-only in `getMetrics` is already verified against live prod in this PR.
