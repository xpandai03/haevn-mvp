# Preview deployments could write to production — containment, cleanup, closure

**Date of work:** 2026-09-20 · **Incident date:** 2026-09-11 · **Status:** contained, cleaned, closed

---

## 1. What was wrong

`SUPABASE_SERVICE_ROLE_KEY` was scoped to **Production, Preview and Development** on the
`haevn-mvp` Vercel project. The service-role key bypasses RLS, so *every preview build* —
every PR branch, past and future — held unrestricted read/write access to the live member
database and could fire real outbound HTTP.

On **2026-09-11**, between **00:27:46 and 00:57:01 UTC**, a preview-hosted QA harness
(PR #39, branch `qa/meetup-harness`) exercised that access against production:

- **8 `meetup_feed_push` runs.** Four were built from **real production data** (`pair_count: 395`,
  `released_rows: 786`) and pushed to the client's real Emergent endpoint, which rejected them
  **401**. Four more ran against fixture data (`pair_count: 4`) into the harness's mock receiver
  (200 / 500).
- **70 synthetic promo-funnel events** into `system_events`, inflating the client's
  upgrade-intent counters.

The nightly production cron is unaffected and never pushed: production's
`MEETUP_FEED_ENABLED` / `EMERGENT_MEETUP_ENDPOINT` / `MEETUP_FEED_PUSH_SECRET` are unset, so
its rows record `push.pushed: false, skipped: true`.

**No member data was modified or exfiltrated.** The harness wrote only `system_events` rows.
The four real-data pushes were rejected 401 by the client's endpoint, so no member-derived
payload was accepted anywhere. No `QA_FIXTURE`-badged partnerships and no `TEST-` display
names exist in production — the harness's own teardown was effective on member tables.

---

## 2. Containment — the env change

`SUPABASE_SERVICE_ROLE_KEY` is now scoped to **Production only**.

Applied via the Vercel API (`PATCH /v9/projects/{id}/env/{envId}` with `target: ["production"]`)
rather than a CLI remove-and-re-add. The env record holds all three targets in one row; a
remove/re-add round-trip would have required reading and rewriting the secret, and a failure
between the two steps would have left production with no key at all. Patching the target list
never touches the value.

```
BEFORE  SUPABASE_SERVICE_ROLE_KEY   ["production","preview","development"]
AFTER   SUPABASE_SERVICE_ROLE_KEY   ["production"]
```

Production scope was untouched and **nothing was redeployed on production**.

### What was deliberately NOT changed, and why

| Var | Left at all three scopes | Reason |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | **Removing it accomplishes nothing.** The production Supabase URL is hardcoded as a fallback in six call sites (`lib/supabase/{admin,server,client}.ts`, `app/auth/{confirm,callback}/route.ts`, `app/api/auth/signup/route.ts`). Every one silently falls back to production when the var is absent. Handled in code by the guard instead. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | `lib/supabase/client.ts` constructs the browser client at **module scope**. Without the key `createBrowserClient` throws during `next build`, so preview builds would **fail outright** rather than degrade to UI-only. Verified directly. |

### Residual risk, stated plainly

With the anon key retained, a preview still reaches production under RLS: someone logged into
a preview as a real member can read and write **that member's own rows**. That is the same
authority the production app grants them and it requires real credentials. It is **not** the
hole that caused this incident — 100% of the Sep 11 contamination went through the service-role
key.

Closing it properly means refactoring `lib/supabase/client.ts` from a module-scope singleton to
a lazy client so a missing key degrades instead of breaking the build. That touches the auth hot
path across the app and is tracked as follow-up, not folded into containment.

---

## 3. Proof that a preview can no longer write to production

A fresh preview of `main` was deployed **after** the env change
(`dpl_4Vk2s4GeHK4DADBudEpwSAbLn93T`) and probed seven times at `/onboarding/membership` — a
route whose server component calls `emitCtaClicked()` → `createAdminClient()` and, before the
change, wrote one `upgrade_cta_clicked` row per request.

| | |
|---|---|
| Preview build with the new scoping | **succeeded** (previews are not broken) |
| Requests issued | 7, all HTTP 200 |
| Rows written to production | **0** |
| `system_events` total, before → after | 21,607 → 21,607 |
| `upgrade_cta_clicked` total, before → after | 98 → 98 |

Five probes carried a traceable `?src=/ISOLATION-PROOF-N` marker; a metadata search for
`ISOLATION-PROOF` in production returns **0 rows**. The page still renders 200 because promo
analytics are deliberately fire-and-forget (`lib/promo/events.ts` swallows emit failures so
analytics can never break a member's upgrade path) — the write simply no longer happens.

---

## 4. Cleanup — 78 rows deleted

### How the synthetic rows were identified

Every predicate was validated against the **full 21,607-row history**, not just Sep 11:

| Cohort | Rows | Positive identifier |
|---|---:|---|
| A. `upgrade_cta_clicked` | 49 | `partnership_id` is a **UUID that does not exist in `partnerships`** |
| B. `founding_offer_viewed` | 21 | same — fabricated `partnership_id` |
| C. `meetup_feed_push` | 8 | `metadata->'push'->>'pushed' = 'true'` |
| **Total** | **78** | all within 2026-09-11 **00:27:46 → 00:57:01 UTC** |

Corroborating evidence:

- **21 distinct fabricated `partnership_id`s**, none present in `partnerships` (914 real rows).
- **Zero** fabricated-`partnership_id` promo events exist anywhere outside Sep 11 — the
  contamination is a single contained burst.
- `src` values of the form `/chat/<uuid>` appear on **Sep 11 only** in all history.
- `reason = 'already_paid'` appears on **Sep 11 only** (28 rows) — it was never legitimate traffic.
- `push.pushed = true` appears on **Sep 11 only**. Every other day carries exactly one
  `meetup_feed_push` (the nightly cron); Sep 11 carried nine.

Deletion was executed **by explicit primary-key list**, not by predicate, so the affected set was
fixed and reviewed before execution.

### The SQL (equivalent to the executed ID-list deletion)

```sql
-- A + B: promo events whose partnership_id was fabricated by the harness
DELETE FROM system_events
 WHERE created_at >= '2026-09-11T00:00:00Z'
   AND created_at <  '2026-09-12T00:00:00Z'
   AND event_type IN ('upgrade_cta_clicked', 'founding_offer_viewed')
   AND partnership_id IS NOT NULL
   AND partnership_id NOT IN (SELECT id FROM partnerships);   -- 49 + 21 = 70 rows

-- C: QA harness feed pushes. The real cron never pushes — production's feed
--    vars are unset, so its rows are push.pushed = false / skipped = true.
DELETE FROM system_events
 WHERE created_at >= '2026-09-11T00:00:00Z'
   AND created_at <  '2026-09-12T00:00:00Z'
   AND event_type = 'meetup_feed_push'
   AND metadata->'push'->>'pushed' = 'true';                  -- 8 rows
```

### Result

```
system_events BEFORE : 21,607
rows deleted         :      78   (4 batches: 25 + 25 + 25 + 3, all confirmed)
system_events AFTER  : 21,529
delta                :      78   ✓ exact
target ids remaining :       0   ✓
```

### What was deliberately KEPT — 6 Sep 11 rows

| Time (UTC) | Event | Why kept |
|---|---|---|
| 05:11:52 | `upgrade_cta_clicked` | `partnership_id = null`, `src = unknown` — a real logged-out member |
| 05:52:51 | `upgrade_cta_clicked` | same |
| 05:53:08 | `upgrade_cta_clicked` | same |
| 08:00:27 | `meetup_feed_push` | the **real** nightly production cron (`pushed: false, skipped: true`) |
| 13:37:05 | `notification_sent` | real member notification |
| 13:37:13 | `notification_sent` | real member notification |

No member row in any table was read for modification, updated, or deleted. The cleanup touched
`system_events` only.

---

## 5. Corrected funnel numbers for the client readout

Post-cleanup, **since 2026-09-07, excluding nothing**:

| Metric | Value |
|---|---:|
| CTA clicks (`upgrade_cta_clicked`) | **39** |
| Offer views (`founding_offer_viewed`) | **35** |
| Activations (`founding_activation_completed`) | **18** |
| Activation rate (activations / CTA clicks) | **46.2%** |
| View → activation (activations / offer views) | **51.4%** |

Per day:

| Date | CTA clicks | Offer views | Activations |
|---|---:|---:|---:|
| 2026-09-07 | 18 | 15 | 8 |
| 2026-09-08 | 2 | 3 | 2 |
| 2026-09-10 | 1 | 1 | 1 |
| 2026-09-11 | 3 | 0 | 0 |
| 2026-09-14 | 15 | 16 | 7 |

For context, the all-time totals moved from 98 / 57 / 18 to **49 / 36 / 18**. Activations were
**never contaminated** — the harness never completed an activation, so that number has not
changed and no previously reported activation figure was wrong.

### Residual contamination on Sep 11

Sep 11 is now materially clean: all 78 positively-identified synthetic rows are gone, and the
three surviving `upgrade_cta_clicked` rows are indistinguishable from ordinary logged-out
traffic (`partnership_id = null`, `src = unknown`) — they are probably real, and they are
counted above.

They cannot be *proven* real, so **"exclude Sep 11" remains the conservative readout
convention**, as it already was. Excluding it moves CTA clicks from 39 to 36 and leaves offer
views (35) and activations (18) untouched. Either figure is defensible; the difference is three
clicks.

---

## 6. The guard (PR: `fix/prod-db-isolation-guard`)

Env scoping is a setting someone can undo with one dashboard click. `lib/supabase/envGuard.ts`
makes the same rule code:

> A non-production **Vercel deployment** may not open a service-role client against the
> production Supabase project.

Wired into all four service-role entry points, before the client is constructed:

- `lib/supabase/admin.ts` → `createAdminClient()` — the choke point for **every**
  `system_events` write, including both promo emitters and the meetup cron
- `lib/supabase/server.ts` → `createServiceRoleClient()`
- `app/api/veriff/webhook/route.ts` → `getSupabaseAdmin()`
- `app/api/auth/signup/route.ts`

Design decisions:

- **Keys on `VERCEL === '1'` plus `VERCEL_ENV !== 'production'`**, not on the absence of
  `VERCEL_ENV`. Local machines and the ops scripts under `scripts/` (`export-meetup-feed`,
  `backfill-*`, `seed-admin-users`) run against production **by design**; breaking them would
  trade a data-integrity hole for an operational one.
- **Guards the resolved URL**, which also closes the hardcoded-fallback hole that env scoping
  alone cannot reach.
- **No bypass flag.** The only way for a non-production deployment to proceed is to point at a
  different database — which is exactly what a separate preview Supabase project would do, so
  the guard does not obstruct that fix later.
- **Fails safe**: an unset or unrecognised `VERCEL_ENV` on a Vercel deployment is treated as
  non-production.

25 assertions in `lib/supabase/__tests__/envGuard.test.ts`. `npm run build` green; `tsc` at the
313-error baseline with **zero new errors**.

---

## 7. Follow-ups (not done here)

1. **Anon-key residual (§2).** Refactor `lib/supabase/client.ts` to a lazy client so
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` can be dropped from Preview without breaking the build.
   Only then are previews genuinely credential-free.
2. **A real preview database.** The structural fix is a separate Supabase project (or a branch
   database) for previews. Not provisioned — it needs approval and has a cost. Until then
   previews are UI-plus-RLS only.
3. **Remove the six hardcoded `KNOWN_SUPABASE_URL` fallbacks.** They defeat env-based
   configuration and were the reason removing the URL var would have been useless.
4. **`REC_MIN` is dead code** in `lib/meetup/buildFeed.ts` (declared, never used), so the feed
   emits every released pair regardless of score. Surfaced by PR #39; a contract question for
   the client, unresolved.
