# Plan — Engagement view (login + re-notify visibility) on the dashboard

Answers the client's "can we tell if anybody's logged in?" One PR: engagement metrics
(logged-in-ever, active-this-week) + a re-notify run card, snapshot capture of the new
keys, and `definitionsVersion` in the snapshot JSONB. Additive only; existing sections
and grids untouched.

## Live counts (2026-07-23, read-only)
| | Network | Austin |
|---|---:|---:|
| total partnerships | 624 | 413 |
| **logged-in-ever partnerships** | **38** (42 people) | 37 |
| **active-this-week partnerships** | **1** | 1 |
| renotify_log rows | 0 (no run yet) | — |

So the strip will read, today: "Logged In Ever: 38 partnerships (42 people) of 624 ·
Active This Week: 1 · Re-notify: no runs yet (disabled)."

## Decision 1 — auth read (reuse vs extract)
`auth.users.last_sign_in_at` is auth-schema → read via `admin.auth.admin.listUsers()`
pagination (PR #8's `lib/renotify/audience.ts` does this as `getLoggedInUserIds`, returning
a **boolean set**). Engagement needs the **timestamp** (for active-this-week), which that
set doesn't carry. OUT forbids modifying re-notify engine files, so I will **not** touch
audience.ts. **Recommended:** a new shared reader `lib/metrics/authLogins.ts` →
`getLastSignInMap(admin): Map<user_id, last_sign_in_at|null>`; engagement derives both
"ever" (value non-null) and "active" (value in week) from it — **one** listUsers pass per
load. audience.ts's `getLoggedInUserIds` is left as-is; a later cleanup can point it at this
reader (out of scope, keeps the engine untouched). Per-request only, no caching infra
(~630 users, ~1 paginated call; timing noted in PR).

## Decision 2 — layout (no reflow of the 8/6 grids)
Insert an **"Engagement"** section **between Section 2 (Weekly) and Section 3 (Composition)**,
with its **own un-numbered header** (icon + "Engagement") so Snapshot=1 / Weekly=2 /
Composition=3 keep their numbers — no existing section renumbers or reflows. Contents:
- **Logged In Ever** — `KpiCard` (value = partnerships, WoW + sparkline from snapshots,
  tooltip carries the person count).
- **Active This Week** — `KpiCard` (value = partnerships; tooltip states the latest-sign-in
  limitation).
- **Re-notification** — one wider custom `ReNotifyCard`: last run date, dry-run badge,
  eligible / sent / suppressed-by-reason / cap-reached, and a **"disabled"** state when no
  live run exists / RENOTIFY_ENABLED is off. Network-wide (labeled), shown at both scopes.

## Metric shapes (additive to `lib/metrics/types.ts`)
```ts
interface EngagementMetrics {
  loggedInEverPartnerships: number
  loggedInEverPeople: number          // person framing (tooltip)
  totalPartnerships: number           // denominator
  activeThisWeekPartnerships: number | null  // null = past week (not computable live)
}
// MetricsResult gains: engagement: EngagementMetrics
// SnapshotPayload gains: engagement: EngagementMetrics; definitionsVersion: number
```
`renotifyStatus` (latest-run summary, the PR #8 GET shape) is **network-only, not per-scope
and not snapshotted** — fetched once in the API route and returned top-level; the card always
shows the latest live run.

## activeThisWeek — the honest limitation (counterexample-safe)
`last_sign_in_at` holds only the LATEST sign-in, so "active in week W" is only correct for the
**current** week. `resolveEngagement` computes it **only when the selected week is the current
reporting week**; for a past week it returns **null**, and the card shows "available from
snapshots after <first-snapshot date>" or the snapshot value — **never** a wrong number
computed from latest-sign-in. Same current-live / past-snapshot split the weekly cards use.

## Snapshot + definitionsVersion
`runSnapshot` payload gains `engagement` (so WoW/sparklines accrue from the next Saturday) and
`definitionsVersion` (= **2**). New `lib/metrics/definitionsVersion.ts`:
`SNAPSHOT_DEFINITIONS_VERSION = 2` + notes map (`1` = pre-PR#7 boolean surveys; `2` =
completion_pct surveys + engagement metrics). `getSnapshotHistory` unchanged; the engagement
sparkline/WoW reader **tolerates absent `engagement`/`definitionsVersion`** on old rows
(filter undefined → renders from rows that have them; old rows treated as v1). Immutable
history untouched.

## Files
- NEW `lib/metrics/authLogins.ts` (`getLastSignInMap`), `lib/metrics/definitionsVersion.ts`.
- `lib/metrics/getMetrics.ts` — `resolveEngagement(admin, scopeIds, week, isCurrentWeek)`
  (pure partnership-level helpers exported for tests) + `engagement` in the result.
- `lib/metrics/types.ts` — additive `EngagementMetrics`, `RenotifyStatus`.
- `lib/metrics/runSnapshot.ts` — `engagement` + `definitionsVersion` in payload.
- `app/api/admin/network-metrics/route.ts` — add `renotifyStatus` (reuse PR #8 GET query).
- `components/admin/network/` — `EngagementStrip` + `ReNotifyCard`; `derive.ts`
  `engagementMetric()` (tolerant); `tooltips.ts`; wire into `NetworkPerformanceClient`
  between Weekly and Composition. Existing cards/grids untouched.
- Tests: partnership login resolution (couple one-logged-in → counts; week boundary),
  activeThisWeek current-vs-past (null for past), snapshot payload has new keys + version,
  history read tolerates old rows, renotify summary shape.

## Guardrails
No PII (counts only). Additive-only to types + snapshot JSONB. No re-notify engine changes.
Existing 8/6 grids and Sections 1–3 numbers unchanged. Off-hours deploy.
