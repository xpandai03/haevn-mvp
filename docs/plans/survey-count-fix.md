# Plan — execute PR #6 corrective actions (survey-count definition fix)

Spec: `docs/investigations/survey-count-reconciliation.md` (PR #6). One PR: definition
switch + one-time backfill + de-fork the import writer + tests. No UI, no Mongo, no
webhook-write changes, no other metric touched.

## Live re-pin (2026-07-23 ~02:08 UTC) — within ±0 of the report, safe to proceed
| Quantity | Value |
|---|---|
| `user_survey_responses` total | 619 (distinct `partnership_id` = 619, **0 null** → table is 1:1 with partnerships) |
| completion_pct ≥ 100 | **467** |
| completion_pct 1–99 | **152** |
| completion_pct 0 / null | **0** |
| current `survey_complete=true` / false | 122 / 506 |
| **backfill predicate** (sc=false & pct≥100) | **346** |
| **anomaly** (sc=true & pct<100/absent) — must NOT demote | **1** |

Because USR is 1:1 with partnerships, **partnership-keyed == user-keyed** here:
completed 467, incomplete(1–99) 152 either way. `467 + 152 = 619` (sums to total USR ✓).

## Decision: mirror-definition & never-started
Per the task's decision rule, Incomplete = **started-but-unfinished, `completion_pct BETWEEN 1 AND 99`** (not `<100`, so a future 0/null row isn't miscounted). **Never-started**
(no survey row, or pct 0/null) is counted in **neither** bucket — today that's the ~9
partnerships with no USR row (0 rows are pct 0/null). Flagged for a future product decision;
not added to Incomplete in this PR.

## 1. getMetrics definition switch (`lib/metrics/getMetrics.ts`)
`surveyCounts()` re-keyed from `profiles.survey_complete` (person/boolean) to
`user_survey_responses.completion_pct` (partnership-scoped, path-independent).

Before:
```ts
// network
headCount(profiles, survey_complete = true)   // 122
headCount(profiles, survey_complete = false)  // 506
```
After (param becomes `scopeIds` = partnership set, matching the rest of the module):
```ts
// network
headCount(user_survey_responses, completion_pct >= 100)                 // 467
headCount(user_survey_responses, completion_pct >= 1 AND <= 99)         // 152
// market: fetch (partnership_id, completion_pct), keep partnership_id ∈ scopeIds, bucket
```
Add exported pure helpers `isSurveyComplete(pct)` / `isSurveyStarted(pct)` (single source
of the boundary) and use them for the market path + tests. Resolve the `// OPEN QUESTION`
comment to a note citing the investigation doc. `types.ts` keys unchanged (same shape,
corrected values). No other metric’s query touched.

## 2. Backfill — numbered migration `046_backfill_survey_complete.sql` (promote-only, idempotent)
```sql
UPDATE profiles p
SET survey_complete = true
WHERE p.survey_complete = false
  AND EXISTS (SELECT 1 FROM user_survey_responses u
              WHERE u.user_id = p.user_id AND u.completion_pct >= 100);
```
- **Promotes only** (sets true, only where currently false) — never demotes; the 1 anomaly
  (sc=true, pct<100) is untouched by construction.
- **Idempotent**: re-run matches 0 rows (the `survey_complete = false` guard). 
- Expected ~**346** (logged in PR; applied in the deploy window, like 045 was).

## 3. De-fork the import writer (`lib/import/emergentImport.ts:382`)
`survey_complete: submitted && completionPct >= 100` → `survey_complete: completionPct >= 100`.
Drops the unstored `submitted` gate (the original cause of the 346). Webhook path
(`lib/ingest/completionV1.ts:190`, hard `true`) already correct — **confirmed, unchanged**.
`mapEmergentSubmission` is exported → unit-tested (below).

## 4. Snapshot continuity (immutable history — do NOT rewrite)
Pre-fix `network_snapshots` rows hold the old boolean-based completedSurveys (~109–122).
The week the fix lands, WoW for completed/incomplete shows **one artificial jump**
(≈122→467, 506→152). Mitigation: a one-line comment where snapshots are read
(`lib/metrics/getSnapshotHistory.ts`) + PR call-out. **Proposed (not built):** a
`definitionsVersion` field in the snapshot JSONB so future readers can detect the break —
proposed in the PR for approval, not added unilaterally.

## 5. Tests (`npx tsx`, repo convention)
- **Boundary** (`isSurveyComplete`/`isSurveyStarted`): pct 100→complete, 101→complete,
  99→started, 1→started, 0→neither, null→neither.
- **Backfill predicate** (pure TS mirror): promotes {sc=false,pct≥100}; never demotes
  {sc=true,pct<100}; leaves {sc=false,pct<100}; re-run promotes 0 (idempotent).
- **Import writer**: `mapEmergentSubmission` with pct=100 → `survey_complete=true` even when
  `submitted` is falsy; pct=99 → false.

## 6. Verify (read-only, post-code)
getMetrics network: completed ≈ 467 ±drift, incomplete ≈ 152 ±drift, sum == USR total.
Austin scope: proportionate. Confirm no other metric value moved.

## Expected outcomes
Completed **122 → ~467**, Incomplete **506 → ~152**; backfill ~346 (promote-only,
idempotent); both ingest paths keep the boolean correct going forward; never-started (~9)
flagged; 1 anomaly logged & preserved; one-time WoW jump pre-explained.
