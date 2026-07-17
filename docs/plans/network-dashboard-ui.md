# Plan — Network Performance dashboard UI (Phase 1)

Builds the real `/admin/network-performance` on top of the PR #2 metrics engine.
UI + one API route + shared admin shell/gate. No changes to `lib/metrics` except
additive pure helpers. Mockup left intact for visual diffing.

## Decisions needing sign-off (see chat)
1. **Shell = route group `app/admin/(network)/`, NOT `app/admin/layout.tsx`.** A
   layout at `app/admin/` would wrap the EXISTING admin pages (matching,
   import-users, match-inspection) in the new sidebar — that's refactoring them,
   which the spec forbids this PR. A route-group layout wraps only the new page;
   existing pages are untouched. Follow-up: move them under the shell + requireAdmin.
2. **Sparklines = inline SVG, not recharts.** The 4 composition charts are the
   "first real recharts usage." 14 tiny sparklines as recharts instances is weight
   for no gain; a ~15-line SVG polyline is lighter and identical visually.
3. **Past-week weekly activity reads from snapshots, current week reads live.**
   `computed_matches` is rewritten weekly, so a live query for a PAST week is wrong.
   Current week → live `getMetrics.weekly`; past week → that week's snapshot row;
   missing → "No snapshot for this week yet." Snapshot section is always current
   (week-independent) per acceptance #3.

## Auth / shell
- `lib/admin/requireAdmin.ts`:
  - `requireAdminPage(): Promise<User>` — getUser → isAdminUser → `redirect('/account-details')` on failure.
  - `requireAdminRoute(): Promise<{ok:true,user} | {ok:false,response:NextResponse(401)}>`.
- `app/admin/(network)/layout.tsx` (server) — `await requireAdminPage()` then `<AdminShell active="network-performance">`.
- `components/admin/AdminShell.tsx` (client) — persistent left sidebar. Active:
  Network Performance. Disabled coming-soon (no links, `aria-disabled`, muted):
  Users, Surveys, Matches, Connections, Content, Reports, Settings. "Tools" area
  reserved (labeled, empty). Responsive: desktop fixed sidebar; tablet/mobile
  collapses behind a hamburger (Sheet, side=left).

## API — `app/api/admin/network-metrics/route.ts` (GET, allowlist-gated)
Params: `scope` (`network` | market_name), `week` (weekEnding `YYYY-MM-DD`, optional → current).
One round trip:
```ts
{
  scopeLabel: string,
  selectedWeek: { weekEnding, start, end, label, priorWeekEnding, priorLabel, isCurrent },
  metrics: MetricsResult,          // getMetrics({scope, week}) — snapshot(current) + weekly(selected)
  composition: Composition,        // getComposition({scope})
  surveyedInScope: number,         // survey-response count in scope (intent % denominator)
  history: Array<{ snapshot_date, market_name, metrics: SnapshotPayload }>, // ≤12, asc
}
```
- History read via a new additive helper `lib/metrics/getSnapshotHistory.ts`
  (`getSnapshotHistory(scope, limit=12)` → rows for `market_name IS NULL` (network)
  or `= market`, ordered by snapshot_date asc). Read-only, additive.
- `surveyedInScope`: count of `user_survey_responses` for users in scope (route-level;
  reuses scope resolution). Only used for the intent caption denominator.

## Page + client state
- `app/admin/(network)/network-performance/page.tsx` (server, thin) → `<NetworkPerformanceClient/>`.
- `components/admin/network/NetworkPerformanceClient.tsx` (client):
  - state: `scope` (default network), `week` (default current). On change → refetch.
  - `useEffect` fetch `/api/admin/network-metrics?scope&week`; states: loading
    (`HaevnLoader`), error (message + Retry), empty (per-scope / per-week copy).
  - renders: Header/selectors → InfoBanner → Section 1 → Section 2 → Section 3 → Freshness footer.

## Component tree (all under `components/admin/network/`)
```
NetworkPerformanceClient
├─ DashboardHeader            title "Network Performance" / "Network Health Overview"
│  ├─ ScopeSelect             Network (All Cities) + live markets (/api/admin/markets)
│  ├─ WeekSelect              current + recent 8 weeks; "June 29 – July 5, 2026" + "vs …"
│  └─ RefreshButton
├─ InfoBanner                 spec copy (teal, not the mockup's amber "mockup" warning)
├─ Section "Network Snapshot"
│  └─ KpiCard ×5  +  BlockedCard ×3      (StatTile/BlockedTile adapted + WoW + sparkline + tooltip)
├─ Section "Weekly Activity"
│  └─ KpiCard ×6                          (honest zeros; WoW vs prior week)
├─ Section "Network Composition"
│  ├─ CompositionDonut  Gender            (recharts PieChart via chart.tsx)
│  ├─ CompositionDonut  Orientation
│  ├─ CompositionBar    Relationship Intent  (+ "members may select multiple intents")
│  └─ CompositionBar    Age Distribution
└─ FreshnessFooter        "Data as of <generatedAt> · <scope> · reporting week <range>"
```
Shared primitives:
- `KpiCard` — adapts mockup `StatTile`: label + info-tooltip, `text-2xl tabular-nums`
  value, `<WowDelta>`, `<Sparkline>`, optional footnote. No cursor-pointer (drill-down deferred).
- `BlockedCard` — adapts mockup `BlockedTile` + honest tooltip.
- `WowDelta` — current vs prior snapshot value: ▲/▼ absolute + %; no prior → quiet
  "collecting history" (never a fake 0%).
- `Sparkline` — inline SVG polyline from history metric series; ≤1 pt → single dot.
- `CompositionDonut` / `CompositionBar` — recharts + `--chart-1..5`; each shows
  count + %, total represented; segment rendering structured so an onClick can be
  added later (no handler now).

## Tooltip content (honest; blocked = "available after …")
Total Members "counted as partnerships (a couple counts once)"; Never Matched
"currently 'no current match' — lifetime needs history retention"; Plus Members /
Plus Conversion "available after the payment-tier (Lemonsqueezy) fix"; Meetup Shares
"available after meetup-share instrumentation"; weekly cards define the ≥80 / 77–79
bands + "this reporting week". (Full map in code.)

## Additive helpers in lib/metrics (no behavior change)
- `reportingWeek.ts`: `formatReportingWeek(week): string`, `recentWeeks(n, now?): ReportingWeek[]`, `weekFromEnding(weekEnding): ReportingWeek`.
- `getSnapshotHistory.ts`: history read (above).

## States / responsive / guardrails
- Loading `HaevnLoader`; no-data-for-scope / empty-week copy per spec; API failure
  visible + Retry.
- Desktop sidebar + 4-wide charts; tablet 2-col, sidebar collapses; mobile stacked.
- No PII (counts only). No service-role / CRON_SECRET client-side. Export button omitted.

## Acceptance mapping
Gate (redirect + 401) · both scopes live · week changes Weekly only · 3 BlockedTiles ·
composition %+count+total + intent caption · 0/1-snapshot graceful · no console errors / no tablet break.

## Follow-ups (PR description)
Migrate existing admin pages to `requireAdmin` + shell; delete mockup after sign-off;
drill-down/compare/export/quick-actions/member-search (later phases).
