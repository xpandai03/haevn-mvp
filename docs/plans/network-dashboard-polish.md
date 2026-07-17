# Plan — Network Performance dashboard: visual parity + 3 functional adds

Visual polish of the existing live dashboard + snapshot button + quick-actions bar
+ CSV export route + freshness footer. No `lib/metrics` logic changes; API payload
gains one additive field. No new deps (lucide + existing stack only).

## Logo (gate cleared)
Found: `public/haevn-logo-with-icon.svg` — the exact asset `/admin/matching` renders.
SVG → use a plain `<img>` (as `/admin/matching` does). Reused, not regenerated.

## Discrepancy to flag
The **code** mockup (`NetworkDashboardMockup.tsx`) `StatTile` is icon-less and its
sparklines don't exist — but the spec text (and Rik's reference image) explicitly
require per-card icons in tinted squares + per-card colored sparklines + numbered
sections. Spec text is the instruction → I add them, using the icon map below.
Noted here so the "mockup wins on visuals" rule isn't read as "leave cards flat."

## Before → after (files touched)
- `components/admin/AdminShell.tsx` — replace the "H / HAEVN Admin / CONSOLE" text
  block with `<img src="/haevn-logo-with-icon.svg">` linked to
  `/admin/network-performance`, "Admin Console" muted beneath. Sidebar otherwise unchanged.
- `components/admin/network/primitives.tsx` — `Sparkline` gains a `color` prop
  (default teal); `WowDelta` unchanged; `InfoTip` unchanged.
- `components/admin/network/cards.tsx` — `KpiCard` + `BlockedCard` gain an icon in
  a tinted rounded square (per-card accent), value row unchanged, sparkline colored
  per card. Blocked keeps dashed-amber but adopts the icon-square layout.
- `components/admin/network/NetworkPerformanceClient.tsx` —
  - Numbered `SectionHeader` (1/2/3 filled circle) + right-aligned helper text.
  - Per-card icon+color maps wired into the card grids (Snapshot 4-up, Weekly 3-up).
  - Header: add **Run snapshot** button (POST `/api/admin/snapshot-network`, toast
    with rows written, then refetch).
  - **Quick-actions bar** below Composition: Export Member List + View Never Matched.
  - **Freshness footer** rewritten to the spec copy with relative "refreshed N ago".
- `components/admin/network/CompositionChart.tsx` — grid becomes 4-across at desktop
  (`xl:grid-cols-4`, `lg:grid-cols-2`); legend already shows count + %. Minor density.
- `app/api/admin/network-metrics/route.ts` — add top-level `generatedAt` (additive;
  mirrors `metrics.generatedAt`).
- **NEW** `app/api/admin/export-members/route.ts` — GET, allowlist-gated, scope-aware CSV.

## Icon + accent map (lucide-react, already installed)
Snapshot: Total Members `Users` · Incomplete Surveys `ClipboardList` · Completed
Surveys `ClipboardCheck` · Members (Free) `CircleUser` · Plus Members `Star`
(blocked) · Plus Conversion `Percent` (blocked) · Never Matched `HeartCrack` ·
Meetup Shares `Share2` (blocked).
Weekly: Matches `Sparkles` · Recommendations `ThumbsUp` · Nudges `Bell` · Ready to
Meet `Zap` · New Connections `Link2` · Conversations `MessageCircle`.
Accent per card cycles the brand/chart palette (teal, orange, navy, chart-3/4/5) so
sparklines are colored, not all-teal. Blocked cards keep amber.

## Quick-actions bar (two working buttons only)
- **Export Member List** → fetch `/api/admin/export-members?scope=…`, blob-download
  CSV. Columns (NO PII): `partnership_id, city, membership_tier, survey_status,
  created_date`. `survey_status` = owner's `profiles.survey_complete` → "complete"/
  "incomplete". Scope-aware via `resolvePartnershipScope` (network = all).
- **View Never Matched** → `scrollIntoView` to the Never Matched card (gets an `id`)
  + toast "Drill-downs arrive in the next phase." No filtering yet.
The spec's other two actions are NOT built (render nothing, no dead UI).

## Freshness footer copy
"Data refreshed {relative} ago · Current State metrics are live. Weekly Activity
reflects the selected reporting week. WoW compares to the immediately preceding
reporting week." Relative from `generatedAt`.

## Run-snapshot button
Header button → POST `/api/admin/snapshot-network` (exists). Toast success with
`written` count (or failure — e.g. if migration 045 isn't applied yet), then refetch.

## Responsive
Snapshot 4-up desktop / 2-up tablet / 1 mobile; Weekly 3-up / 2 / 1; Composition
4-up / 2×2 / 1. Quick-actions wrap. Re-verify tablet/mobile after density changes.

## Guardrails
No PII in export or UI. No drawers/cross-filter/compare/search. No `lib/metrics`
logic change. `next build` compiles; screenshots pending 045 + admin session (same
external blockers as PR #3 — will capture on a preview/prod URL).

## Deliverable
One PR: polish + quick-actions + export route + snapshot button + plan file.
