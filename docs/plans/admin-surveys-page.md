# Plan — /admin/surveys + nav cleanup + Matches pair-dedup (admin suite v1 finish)

One PR: (1) survey-funnel visibility page, (2) sidebar reduced to the 4 real pages +
Tools, (3) Matches deduplicated to one row per pair. Read-only. PII = Users-page level.

## Schema pass (read-only, 2026-07-23)
- **`user_survey_responses`** (622 rows, 1:1 w/ partnerships): `user_id, completion_pct,
  current_step, created_at, updated_at, answers_json, partnership_id`.
  - **Only `created_at` is meaningful.** `updated_at == created_at` on **all 622** rows →
    the survey record is written ONCE at ingest and never edited in HAEVN (editing happens
    in the Emergent survey app). So **no "last activity" signal exists app-side.** Show
    **"Created"** (HAEVN record/arrival time), honestly labeled — NOT "last activity."
    True survey start/activity timing is marketing-side (cross-system gap, noted).
- **Cohorts**: complete (`≥100`) **470** · in-progress (`1–99`) **152** · pct-0 **0** ·
  **never-started (profiles with no survey row) 9** → 631 = all profiles. Uses PR #7
  `isSurveyComplete`/`isSurveyStarted`.
- **Reminder tracking: NONE app-side** (grep clean; `nudge_sent` is a *match* nudge, unrelated).
  The 24/72h reminders run in the client's marketing stack → **cross-system gap, no column.**
- **Provenance** (optional, cheap): `survey_ingest_log.user_id` distinguishes webhook-era
  arrivals from manual imports. Include a light **Source** indicator (webhook / import) — it
  ties directly to the PR #6/#7 reconciliation the client cares about.
- **Matches mirroring**: `computed_matches` **378 rows = 189 unique unordered pairs** (every
  pair stored BOTH A×B and B×A, same score). See §Dedup.

## Never-started synthesis (the invisible cohort)
Base = **profiles** (631), left-joined to `user_survey_responses`. Members with no survey row
appear as **"Not started"** (no created date, no progress bar) — never silently dropped.

## API — `app/api/admin/surveys/route.ts` (GET, allowlist-gated, server-side)
Reuses the Users batched join (profiles ⋈ members ⋈ partnerships for city/market, `getLastSignInMap`
for sign-in). Params: `search` (name/email/ID), `status` (all|complete|in_progress|not_started),
`band` (in-progress pct: all|lt25|mid|gt75), `market` (all|<name>|unresolved), `login`
(all|ever|never), `source` (all|webhook|import), `sort` (pct|created|name|last_sign_in), `dir`,
`page`, `pageSize` (48).
```ts
SurveyRow = { userId, name, email, city, market, status:'complete'|'in_progress'|'not_started',
  completionPct: number|null, createdAt: string|null, lastSignInAt: string|null,
  source:'webhook'|'import'|null, partnershipId }
summary = { total, complete, inProgress, neverStarted, medianPctInProgress }
```
**High-value combo made easy:** `status=complete` + `login=never` = the re-notify audience,
visible. filter/sort/paginate in TS (631 rows; fine at 10×).

## Page — `/admin/surveys` (under AdminShell, active="surveys")
Header counts (complete / in-progress / never-started + median in-progress %). Filter bar +
search. Table: **Member** (name + ID) · City/Market · **Status** chip · **Completion %**
(progress bar; blank for not-started) · **Created** · **Source** · **Logged in** indicator ·
link → the member's Users detail (`/admin/users?focus=<id>` cheap cross-link — Users page reads
`?focus` to open that member; if not worth it, plain link to /admin/users). Pagination, empties.

## Sidebar cleanup (AdminShell)
`PRIMARY_NAV` reduced to exactly **Network Performance · Users · Matches · Surveys** (all active,
all `href`). **Remove entirely** (not SOON): Connections, Content, Reports, Settings. Tools keeps
**Matching Ops**; **remove the "Utilities (soon)"** item. `NavKey` += `'surveys'`; `deriveActive`
handles `/admin/surveys`. (Verified: no routes exist for the removed items — they were placeholders.)

## Matches dedup (one row per pair) + count reconciliation
Canonicalize server-side in the matches route: keep **one row per unordered pair**, the one where
`partnership_a < partnership_b` (deterministic; both directions carry the same score). Applied right
after `buildRows`, so filter/sort/**counts**/paginate all operate on unique pairs. Pure
`dedupePairs()` in `matchRows.ts` (tested: A×B ≡ B×A, canonical survives). Inspect link uses the
canonical order (match-inspection works either way).
- **Counts change: 12/366 → 6/183** (unique pairs). Matches page copy updated to say **"unique
  pairs"**, with a note that the **dashboard's "Matches Generated" counts per member (directional),
  so it reads ~2×** — the two are intentionally different units, both correct. No dashboard change (OUT).

## Tests
Survey status derivation incl. **never-started** (profile w/ no row), pct-band filters
(lt25/mid/gt75), median-of-in-progress, `login=never & complete` combo; **dedupePairs**
(A×B≡B×A, deterministic survivor, counts halve consistently); nav config renders **exactly four
primary items + Tools/Matching Ops** (removed items absent).

## Guardrails
Read-only. No sends, no reminder buttons, no invented activity semantics (Created ≠ activity).
No survey/webhook changes, no dashboard changes. PII = Users level. Off-hours deploy.
