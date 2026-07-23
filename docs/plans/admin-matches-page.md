# Plan — /admin/matches (searchable match list, 2nd admin page)

A read-only, searchable/sortable/filterable list of the **current** match set with
city/market, dates, status, and connection folded in — so the client can "look at all
matches without cherry-picking." Under AdminShell, sidebar "Matches" flipped active.

## Schema verification (read-only, 2026-07-23)
`computed_matches` (378 rows): `id, partnership_a, partnership_b, score, tier, breakdown,
computed_at, engine_version, release_at, **expires_at**, saved, saved_at, sms_notified_at`.
- **Expiry EXISTS** — `expires_at` set on all 378 rows (0 expired now). We show it (real, not invented).
- Status now: **released 8** (`release_at<=now`) · **pending 370** (`release_at` future, next Monday) · **notified 258** (`sms_notified_at` set) · saved 0. Bands: `score>=80` = 12 matches, `77–79` = 366 recs.
- Destructive weekly rewrite → this is the **current set only**; no history (see proposal §History).
- `handshakes` 0 · `conversations` 0 · `hidden_matches` 0 · `ready_to_meet_signals` 2 · `signals` table **does not exist**.
- `partnerships.display_name` is **NULL** → names come from `profiles.full_name` via `partnership_members` (the fallback chain in `lib/actions/adminMatching.ts` `resolvePartnershipName`).

## Status-vocabulary gaps (client said Pending/Accepted/Declined/Connected/Conversation)
| Client term | Real source | In v1? |
|---|---|---|
| Pending | `release_at > now` | ✅ |
| Released / Notified | `release_at<=now` / `sms_notified_at` | ✅ (added — real & useful) |
| Connected | `handshakes` (mutual, 0 rows, wired) | ✅ (shows when rows exist) |
| Conversation started | `conversations` (0 rows, wired) | ✅ |
| Declined / Passed | `hidden_matches` (0 rows, wired) — "passed for 30d" | ✅ (shown as "Passed") |
| Ready to meet | `ready_to_meet_signals` (2 rows) | ✅ |
| **Accepted (one-way)** | **none** — no per-match accept state; `signals` table absent | ❌ **instrumentation gap** — listed, not faked |
So "Accepted" as a distinct one-way state does not exist; only mutual "Connected" does. Documented, no fake column.

## PII / names
Old matching page shows `full_name` (or ID). Per the guardrail (≤ that exposure), we show
**"First L." + partnership-ID short** (e.g. "Alex C. · 28f580f7"), batched — a *reduction*
vs the old page, never more. Resolved server-side, no PII in the API beyond this.

## API — `app/api/admin/matches/route.ts` (GET, allowlist-gated, server-side)
Params: `search` (name/ID substring), `band` (all|match|rec), `status` (all|pending|released|notified),
`market` (all|<market_name>|unresolved), `scoreMin`, `scoreMax`, `sort`
(score|computed_at|release_at|name), `dir` (asc|desc), `page`, `pageSize` (default 50).
Approach (no N+1, fast at 10×): fetch `computed_matches` (DB filters for score/band/status where
trivial), then **batch-resolve** names (members→profiles.full_name), cities/market (releaseGate
index), and connection sets (handshakes/conversations/hidden/ready_to_meet — all tiny, fetched
whole); apply market/search/status filters + sort + paginate in TS. Returns:
```ts
{ rows: MatchRow[], total: number,
  counts: { matches, recommendations, released, notified, connected } }  // over the FILTERED set
MatchRow = { id, partnershipA, partnershipB, nameA, nameB, score, band:'match'|'rec', tier,
  cityA, cityB, market: string|'Unresolved'|'Mixed', computedAt, releaseAt, expiresAt,
  releaseStatus:'pending'|'released', notified:boolean, saved:boolean,
  connection:'connected'|'conversation'|'passed'|'ready_to_meet'|null,
  inspectHref:'/admin/match-inspection?a=..&b=..' }
```

## Page — `/admin/matches` (under AdminShell, active="matches")
Thin gated page → `MatchesClient` → the API. Header: **"Current match set · computed <date>"**
+ last recompute. **Counts strip** (filtered): N matches · M recs · K released · J notified · C connected.
Filter bar: band / status / market selects + search box + score-range. Sortable column headers.
Paginated shadcn `<Table>`. Columns: **Pair** (nameA × nameB + IDs) · **Band** (Match/Rec badge) ·
**Score** · **Market / Cities** (market once if both sides match; else both cities; "Unresolved"
for fail-closed) · **Computed** · **Release** (date + Pending/Released chip) · **Notified** ·
**Expires** · **Connection** · **Inspect** → `/admin/match-inspection?a=&b=` (verified param shape).
Empty states: no-results (filter), "Unresolved" market rows still render, Monday-rewrite note.

## Sidebar activation (AdminShell — in scope)
`matches` nav item gains `href:'/admin/matches'`; **NavList renders any item with an `href` as a
real link** (active-styled when current) so both pages navigate between each other. `NavKey` gains
`'matches'`; AdminShell derives `active` from `usePathname()` (so one layout serves both pages).
Route group `app/admin/(network)/` now wraps `network-performance` **and** `matches` (layout gate unchanged).

## History-retention proposal (SIZED — NOT built this PR; needs approval)
`computed_matches` is wiped weekly, so churn/retention/"was this pair ever matched"/true-never-matched
are **permanently unrecoverable** unless we start now. **Proposal:** append-only `match_history`
(migration ~047-style: `id, run_date, partnership_a, partnership_b, score, tier, released_at,
computed_at`), populated by the **recompute cron** (one `insert … select from computed_matches`
after each run) — analogous to `network_snapshots`. Size: ~1 migration + ~15 lines in the cron;
grows ~378 rows/week (~20k/yr, trivial). **Starting now buys:** WoW match churn, pair-match history,
retention/expiry analytics, and fixes the dashboard's "Never Matched" caveat (true lifetime never).
Recommend a small follow-up PR right after this one. Not in scope here.

## Tests
Filter/search query building, band boundary (79→rec, 80→match, from scoreBands), status derivation
(pending/released/notified from release_at/sms_notified_at), city batch resolution incl. "Unresolved",
"First L." name reduction, pagination math, counts-over-filtered-set.

## Guardrails
Read-only. Server-side search/sort/filter/pagination. PII ≤ old page (First L. + ID). No algorithm/
pipeline/control-center changes. No accept/decline UI, no editing, no invented expiry, no history table.
