# Survey-count reconciliation — "Completed Surveys" 109 vs Mongo 354

**Read-only investigation. No fixes applied. No PII.**
Counts pinned from production (service-role, read-only) at **2026-07-23 ~01:54–01:57 UTC**.
The pipeline is live; numbers move daily (see drift note).

---

## TL;DR

The dashboard's **Completed Surveys** counts `profiles.survey_complete = true`. That
boolean is **only reliably set by the webhook ingest path, which went live 2026-07-17**.
Every survey that arrived *before* that (the manual-JSON-import era — the bulk of the
base) has its answers stored and `completion_pct = 100`, but its `survey_complete`
boolean was left **false**. So the dashboard sees a fraction of the truly-complete base
and climbs a few per day as the webhook flips booleans.

- **346** real users are **content-complete (`completion_pct = 100`) but `survey_complete = false`.** 100% of them were created **before** the 2026-07-17 webhook cutover; **344/346 are absent from the ingest log.** This is the whole story.
- Switching the definition to `completion_pct >= 100` yields **467** (466 real) — which **exceeds** Mongo's 354, so the dashboard undercount is fully explained (there is no population of Mongo-completes missing from the app).
- **`survey_reviewed` is a red herring** — it is `true` for **623/623** rows. Hypothesis (c) is dead.
- The **506 = 506** match (Incomplete card vs Mongo total) is a **coincidence** (a moving number), not shared lineage.

**Recommended source of truth:** count `user_survey_responses.completion_pct >= 100`, not the boolean.

---

## 1. Pinned numbers (2026-07-23 ~01:55 UTC)

| Table | Count | Breakdown |
|---|---|---|
| `profiles` | **628** | `survey_complete`: **true 122** · false 506 · null 0 |
| `user_survey_responses` | **619** | `completion_pct`: **≥100 → 467** · 1–99 → 152 · 0 → 0 · null → 0 |
| `partnership_members` | 623 | `survey_reviewed`: **true 623** · false 0 · null 0 |
| `survey_ingest_log` | 114 | result: created 110 · duplicate 3 · updated 1 · distinct user_id 114 |
| `survey_ingest_log.received_at` | — | **2026-07-17 18:08Z … 2026-07-22 23:20Z** (webhook era) |

**Drift:** Completed Surveys was **96** on Jul 17, **109** at the time of this ticket,
**122** now — ~+4/day as the webhook flips booleans. `survey_complete = false` has held
at ~506 because new sign-ups replenish "false" as fast as the webhook drains it (this is
what makes the 506/506 match unstable — see §5).

### Dashboard lineage (query-by-query)
The card is **Network scope**, which is **ungated** — `getMetrics` runs, for network:

```
completedSurveys  = profiles WHERE survey_complete = true         → 122   (no city/market filter)
incompleteSurveys = profiles WHERE survey_complete = false        → 506   (no city/market filter)
```

(`lib/metrics/getMetrics.ts:288-289`, `surveyCounts()`.) There is **no market join** on the
network path, so **market gating is ruled out** as an explanation — confirmed, not assumed.

---

## 2. Every writer of `profiles.survey_complete` (repo trace)

| Path | File | Condition it sets `true` |
|---|---|---|
| **Webhook ingest** (contract `completion_v1`) | `lib/ingest/completionV1.ts:190` | **Hard `true`** on every completion event. Live since 2026-07-17. |
| **Manual JSON import** (Emergent) | `lib/import/emergentImport.ts:382` → `app/api/admin/import-users/route.ts:133` | `submitted && completionPct >= 100` — **gated on a `submitted` flag** that is *not* stored in the DB. Initial profile row is created `false` (`emergentImport.ts:286`). |
| **In-app survey completion** | `app/api/survey/save/route.ts:301`, `lib/actions/survey-user.ts:311`, `lib/actions/survey.ts:261`, `lib/db/survey.ts:192`, `lib/services/partnership.ts:190` | `true` on save/100%. |
| Seed / synthetic | `scripts/seed-synthetic-users.ts:531`, `scripts/seed-admin-users.ts:255`, `scripts/populate-test-survey.ts:233` | `true` (test data; now essentially purged — see §4). |
| Legacy trigger | `supabase/survey-setup-fixed.sql:75` | Trigger on `survey_responses` (per-partnership table, 1 live row) — effectively inert. |

**The fork:** the webhook sets the boolean *unconditionally*; the manual import gated it on
`submitted && pct>=100`. `git log -L` on `emergentImport.ts:382` shows that condition existed
from the import feature's first commit (`7d893c8`), so the import genuinely evaluated it
**false** for the 346 — i.e. their Emergent `submitted` flag was not set (the flag is
import-time only and not persisted, so it can't be re-derived app-side). The webhook does **not**
retroactively backfill users who were already imported.

---

## 3. Cross-tab of the candidate definitions (per `profiles` row, n=628)

`survey_complete` (SC) × `completion_pct>=100` (P100) × `survey_reviewed` (REV):

| SC | pct | reviewed | count | meaning |
|----|-----|----------|------:|---------|
| false | **≥100** | true | **346** | **content-complete, boolean missed it ← the gap** |
| false | 1–99 | true | 152 | genuinely incomplete |
| true | ≥100 | true | 121 | agree: complete |
| false | (no USR row) | (no member) | 5 | profile, no survey, no partnership |
| false | (no USR row) | true | 3 | profile + partnership, no survey row |
| true | (no USR row) | true | 1 | boolean true, **no** survey row (1 anomaly) |

Checks: SC true = 121+1 = **122** ✓ · SC false = 346+152+5+3 = **506** ✓ · pct≥100 = 346+121 = **467** ✓.

**Hypotheses, tested in order:**
- **(a) manual-import users never got the boolean — CONFIRMED.** The 346 are *all* created before the 2026-07-17 webhook cutover; **344/346 absent from `survey_ingest_log`**; only **2** appear in the log.
- **(b) in-app completions set a different field — not needed / not the cause.** In-app paths set the same boolean; they are a minority and mostly already `true`.
- **(c) `survey_reviewed` gates the boolean — DEAD.** `survey_reviewed` is `true` for 623/623; it discriminates nothing.
- **(d) a one-time process set it then stopped — reframed.** It wasn't a stopped backfill; it's that the boolean's *only* reliable writer (the webhook) started on 2026-07-17 and doesn't look backward. The 122 are 111 webhook-era + 11 older; 112 are in the ingest log, 10 are not.

---

## 4. Reconciliation against the Mongo anchors

Client-reported ground truth: **all markets 506 total / 354 completed**; Austin ~338 / ~231.
(No MongoDB access here — these are inputs.) By email-domain class (aggregate; no addresses read):

| App population | external/real | seed/test |
|---|---:|---:|
| profiles total | **625** | 3 |
| `completion_pct>=100` | **466** | 1 |
| `survey_complete=true` | **121** | 1 |
| pct100 **&** boolean-false (the gap) | **346** | 0 |

The synthetic/seed cohort is essentially gone (prior test-user purge) — it is **not** inflating
anything. So two clean reconciliations:

**A. Why dashboard 122 ≠ Mongo 354 (the ticket).** The boolean undercounts by **232**. That gap
is *entirely inside* the **346** content-complete-but-boolean-false records — the app actually holds
**more** content-complete real users (466) than Mongo calls complete (354). **Best-estimate: 0
Mongo-completes are missing from the app** (app 466 ≥ Mongo 354). Contrast the prompt's example,
which had 25 absent — here the "absent from app" bucket is **0**.

**B. Why app-content-complete 466 ≠ Mongo 354 (the opposite-direction residual).** The app has
**466** real content-complete vs Mongo's **354** → **+112**. The app also has **625** real profiles
vs Mongo's **506** total → **+119**. The app population has simply grown past the client's Mongo
snapshot and includes **in-app direct sign-ups** (users who never went through the marketing
survey) plus webhook arrivals after the snapshot. Attributing the +112 exactly is the **only piece
that cannot be closed app-side** (see Residual).

**Bucketing the 354 Mongo-completes (best-effort):**
- ~**110** arrived in the webhook era (`survey_ingest_log` created=110) → mostly `survey_complete=true` today.
- the remainder are pre-cutover imports → sitting in the **346** as `completion_pct=100, survey_complete=false`.
- **absent from the app: ~0** (app content-complete 466 ≥ 354).

### Residual (needs a Mongo-side query — for Raunek to run in the demographics view)
The unclosable piece is the **+112** (app real content-complete 466 vs Mongo complete 354).
Run, Mongo-side:
1. **Definition of "completed":** is it a `submitted` flag, or answer-count ≥ threshold? (This is the exact field the app import keyed on.)
2. Count Mongo submissions where **answers are complete but `submitted` is false** — that quantifies records the app would call complete-by-content but Mongo would not.
3. Export the **email set** of the 354 completed; intersect with the app's `completion_pct=100` set to confirm the "0 absent" estimate and split the 346 into "Mongo-complete (should be counted)" vs "app-only/in-app."

---

## 5. The 506 = 506 question

**Coincidence, not shared lineage.** The Incomplete card counts `profiles.survey_complete = false`
(§1), which today is 506 and equals Mongo's total submissions (506) by chance. It is a **moving
number**: as the webhook flips booleans it drains, and new sign-ups replenish it — it was not 506
by construction and will drift off 506. There is no query anywhere that reads Mongo's total, and
the app has **628** profiles / **619** survey rows, neither of which is 506. The card is also
**semantically wrong** in the same way as Completed: those 506 "incomplete" include the **346**
records that are actually content-complete.

---

## 6. Recommendation — single source of truth

**Define "Completed Survey" = `user_survey_responses.completion_pct >= 100`** (content-based,
path-independent), and retire `profiles.survey_complete` as the dashboard metric.

```sql
-- Completed (network / all cities)
SELECT count(*) FROM user_survey_responses WHERE completion_pct >= 100;          -- 467
-- Incomplete = has a survey row that isn't finished
SELECT count(*) FROM user_survey_responses WHERE completion_pct < 100;           -- 152
-- (optional) started-but-no-survey-row profiles, if you want them in "incomplete"
SELECT count(*) FROM profiles p
  WHERE NOT EXISTS (SELECT 1 FROM user_survey_responses u WHERE u.user_id = p.user_id);  -- 9
```

Why this and not the boolean: it is set by the *same* upstream regardless of import-path
(webhook, manual import, in-app), it already matches "answers are done," and it does not lag.
It will read **~467**, above Mongo's 354 for the expected reasons in §4B (document that once, so
the higher number isn't read as a new bug).

If instead the client wants **app == Mongo parity**, the metric must be *provenance-scoped*
(Emergent-origin users only, via `survey_ingest_log` + import lineage) **and** adopt Mongo's exact
`submitted`-based definition — a narrower metric than "how many members finished the survey."

---

## 7. Corrective actions for a follow-up session (sized, NONE executed)

1. **Change the dashboard definition** (`lib/metrics/getMetrics.ts` `surveyCounts()`): count
   `completion_pct` from `user_survey_responses` instead of the `profiles` boolean.
   Effect: Completed **122 → 467**, Incomplete **506 → 152 (+9)**. *(Preferred; no data mutation.)*
2. **OR one-time backfill of the boolean** (if the column must stay authoritative):
   `UPDATE profiles SET survey_complete = true WHERE survey_complete = false AND user_id IN
   (SELECT user_id FROM user_survey_responses WHERE completion_pct >= 100);` → flips **346**.
   Leaves the write-path fork unfixed (future imports will re-diverge).
3. **De-fork the writers:** make the manual-import path set the boolean on `completion_pct >= 100`
   alone (drop the unstored `submitted` gate), matching the webhook — so the two paths agree going forward.
4. **Fix the Incomplete card** the same way (it currently mislabels the 346 as incomplete).
5. **Investigate the 1 anomaly** — `survey_complete = true` with no `user_survey_responses` row —
   and the **9** profiles with no survey row (data hygiene, tiny).
6. **Run the §4 Mongo-side query** to close the +112 residual and confirm "0 absent."

*(All read-only work; no booleans flipped, no rows written, no `getMetrics`/label changes made.)*
