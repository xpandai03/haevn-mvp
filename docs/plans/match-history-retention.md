# Plan — match_history retention (start capturing weekly match sets)

`computed_matches` is destructively rewritten every Monday, so match churn / pair
history / true lifetime "never matched" are **permanently unrecoverable** — every
week without capture is lost. This starts an append-only history. Touches the
release pipeline (the recompute cron), so the capture is **additive and fail-safe**:
it can never break or delay a release.

## Migration `049_match_history.sql` (additive, append-only)
```
match_history( id, run_date DATE, partnership_a UUID, partnership_b UUID,
  score INT, tier TEXT, released_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ, created_at TIMESTAMPTZ default now() )
UNIQUE (run_date, partnership_a, partnership_b)   -- idempotent re-capture
```
Stores the raw `computed_matches` set per run (both pair directions, as-is — dedup at
read time). ~378 rows/week (~20k/yr, trivial). Service-role only (RLS on, no policies).
Reversible: `DROP TABLE match_history`.

## Capture — `lib/services/matchHistory.ts` (pure + injectable, like impersonation)
- `buildHistoryRows(computedRows, runDate)` — pure map to the payload (tested).
- `captureMatchHistory(runDate, { fetchComputed, insertHistory })` — fetches the
  current set, builds rows, **upserts with `ignoreDuplicates` on
  (run_date, partnership_a, partnership_b)** (append-only + idempotent). **Never
  throws** — returns `{ captured, error? }`. A capture failure logs and is ignored.

## Wiring (the pipeline touch — minimal, fail-safe, additive)
In **both** recompute paths, AFTER the recompute + `release_at` override (so the
captured `released_at` is final), wrapped in try/catch:
- `app/api/cron/recompute-matches/route.ts` (the weekly Monday cron)
- `app/api/admin/run-full-cycle/route.ts` (the manual admin full-cycle)
`run_date` = the run's UTC date. The capture is the LAST step before the response;
its result is added to the log/metadata but **its failure changes nothing** about the
release that already happened. No change to the matching algorithm (`computeMatches.ts`)
or the release logic itself — only these two route files gain a fail-safe call.

## Admin surface — `app/api/admin/match-history/route.ts` (allowlist-gated)
- **GET**: captured runs (distinct `run_date` + row count + unique-pair count), newest
  first — verifies capture works + future dashboard source.
- **POST**: **capture NOW** (manual trigger). Lets us seed **this week's** set
  immediately rather than waiting for next Monday — every week counts. Idempotent.

## Tests
`buildHistoryRows` (field mapping, run_date, empty); `captureMatchHistory` fail-safe
(insert error → `{error}`, no throw; fetch throws → caught); idempotent-payload shape;
the upsert conflict key. No cron/algorithm behavior changed beyond the added fail-safe call.

## Guardrails
Additive, append-only, idempotent. Capture NEVER breaks/delays a release (fail-safe).
No algorithm/release-logic change. No dashboard change (read surface is a follow-up).
Off-hours deploy; apply 049 in the deploy window; POST once to seed this week.
