/**
 * Weekly drill-downs (Matches / Recommendations Generated) — card/list parity,
 * the admin gate, the PII convention, and the dashboard card swap.
 *
 * Run: npx tsx lib/admin/__tests__/weeklyPairs.test.ts
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  weeklyBandFilter, inWeeklyBand, dedupeHistory, countPairs, toPairRows, sortPairRows,
  paginate, reconcile, parseBand, channelOf, channelsByPartnership, PAIR_PAGE_SIZE,
  type RawPairRow, type PartnershipLite,
} from '../weeklyPairs'
import { summarizeFoundingActive, FOUNDING_EXPIRY_WINDOW_DAYS } from '../../metrics/getMetrics'
import { deriveActive } from '../adminNav'
import { shortName } from '../matchRows'
import { weekFromEnding } from '../../metrics/reportingWeek'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** Assert about CODE, not the prose that explains it. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const NOW = new Date('2026-09-28T17:00:00.000Z')
const WEEK = weekFromEnding('2026-10-03') // Sun 09-27 .. Sat 10-03
const S = WEEK.start.toISOString()
const E = WEEK.end.toISOString()

/** A minimal query-builder double: records gte/lte and evaluates them in memory. */
function fakeQuery() {
  const preds: ((r: any) => boolean)[] = []
  const q: any = {
    gte(col: string, v: any) { preds.push((r) => r[col] !== null && r[col] >= v); return q },
    lte(col: string, v: any) { preds.push((r) => r[col] !== null && r[col] <= v); return q },
    run(rows: any[]) { return rows.filter((r) => preds.every((p) => p(r))) },
  }
  return q
}

const r = (a: string, b: string, score: number, computed_at: string, extra: Partial<RawPairRow> = {}): RawPairRow => ({
  partnership_a: a, partnership_b: b, score, computed_at, released_at: '2026-09-28T12:00:00.000Z', ...extra,
})

// A fixture week. Directional, like computed_matches: every pair twice.
const MON = '2026-09-28T12:00:17.000Z'
const FIXTURE: RawPairRow[] = [
  r('A', 'B', 91, MON), r('B', 'A', 91, MON),         // match pair
  r('C', 'D', 80, MON), r('D', 'C', 80, MON),         // match pair, boundary 80
  r('E', 'F', 79, MON), r('F', 'E', 79, MON),         // rec, boundary 79
  r('G', 'H', 77, MON), r('H', 'G', 77, MON),         // rec, boundary 77
  r('I', 'J', 76, MON), r('J', 'I', 76, MON),         // below every band
  r('K', 'L', 95, '2026-09-26T23:59:59.999Z'),        // previous week's Saturday
  r('M', 'N', 95, '2026-10-04T00:00:00.000Z'),        // next week's Sunday
  r('O', 'P', 88, E),                                 // exactly the week's last ms
  r('Q', 'R', 78, S),                                 // exactly the week's first ms
]

// ═══ ONE DEFINITION: the card's filter and the list's predicate agree ════════
for (const band of ['match', 'rec'] as const) {
  const viaCardFilter = (weeklyBandFilter(band, S, E)(fakeQuery()) as any).run(FIXTURE)
  const viaListPredicate = FIXTURE.filter((x) => inWeeklyBand(x, band, S, E))
  eq(viaCardFilter.length, viaListPredicate.length, `${band}: card filter and list predicate count the same rows`)
}
eq(FIXTURE.filter((x) => inWeeklyBand(x, 'match', S, E)).length, 5, 'match band: 91×2, 80×2 (80 is a match), and the last-ms row')
eq(FIXTURE.filter((x) => inWeeklyBand(x, 'rec', S, E)).length, 5, 'rec band: 79×2, 77×2, and the first-ms row; 76 is neither')
ok(!inWeeklyBand(r('X', 'Y', 90, '2026-09-26T23:59:59.999Z'), 'match', S, E), 'the previous Saturday is outside the week')
ok(!inWeeklyBand(r('X', 'Y', 90, '2026-10-04T00:00:00.000Z'), 'match', S, E), 'the next Sunday is outside the week')
ok(!inWeeklyBand({ score: null, computed_at: MON }, 'match', S, E), 'a null score is in no band')

// The card really does use the shared filter — for BOTH weekly cards.
{
  const src = code('lib/metrics/getMetrics.ts')
  ok(/weeklyBandFilter\('match', startIso, endIso\)/.test(src), 'Matches Generated card counts through weeklyBandFilter')
  ok(/weeklyBandFilter\('rec', startIso, endIso\)/.test(src), 'Recommendations Generated card counts through weeklyBandFilter')
  ok(!/MATCH_MIN_SCORE|REC_MIN_SCORE/.test(src), 'no second, hand-written band definition left in getMetrics')
}

// ═══ COUNT PARITY for a fixture week: card number === list total ═════════════
{
  const card = (weeklyBandFilter('match', S, E)(fakeQuery()) as any).run(FIXTURE).length
  const listed = FIXTURE.filter((x) => inWeeklyBand(x, 'match', S, E))
  const rows = toPairRows(listed, new Map(), new Map(), { band: 'match', isCurrent: true, now: NOW })
  eq(rows.length, card, 'the list has exactly as many rows as the card counts')
  eq(reconcile(card, rows.length).kind, 'exact', 'reconcile reports exact parity')
  eq(countPairs(listed), 3, 'and states the unique pairs behind them (A–B, C–D, O–P)')
}

// ═══ past weeks: history is deduplicated before it is counted ════════════════
{
  const cap = (run: string, x: RawPairRow) => ({ ...x, run_date: run })
  const history = [
    cap('2026-09-21', r('A', 'B', 91, MON)), cap('2026-09-28', r('A', 'B', 91, MON)), // same computation, re-captured
    cap('2026-09-21', r('B', 'A', 91, MON)),
    cap('2026-09-28', r('A', 'B', 91, '2026-09-29T12:00:00.000Z')),                  // a NEW computation of the pair
  ]
  eq(dedupeHistory(history).length, 3, 'a row re-captured under a later run_date is counted once; a recomputation is its own row')
}

// ═══ reconcile: the card and its list never SILENTLY disagree ═══════════════
eq(reconcile(30, 30), { kind: 'exact', card: 30, listed: 30 }, 'equal → exact')
eq(reconcile(null, 24), { kind: 'no_card', card: null, listed: 24 }, 'no stored snapshot → no_card (the page says so)')
eq(reconcile(1178, 1170), { kind: 'removed', card: 1178, listed: 1170, gap: 8 }, '2026-09-26: 8 rows erased by account deletions → removed, gap 8')
eq(reconcile(10, 12).kind, 'mismatch', 'more rows than the card → mismatch, surfaced, never hidden')
{
  const ui = read('components/admin/network/WeeklyPairsClient.tsx')
  ok(/r\.kind === 'exact'\) return null/.test(ui), 'only EXACT parity renders without a note')
  ok(/no weekly snapshot was stored/.test(ui) && /deleted their accounts/.test(ui) && /should not happen/.test(ui),
    'every non-exact case has its own plain-words note')
  ok(/data\.reconcile\.card \?\? data\.total/.test(ui), "the header count is the CARD's number whenever the card has one")
}

// ═══ PII: first name + last initial, never a full name, email or phone ══════
{
  const people = new Map<string, PartnershipLite>([
    ['A', { name: shortName('Alexandra Chen'), city: 'Austin' }],
    ['B', { name: shortName('Brianna Okafor-Smith'), city: 'Round Rock' }],
  ])
  const [row] = toPairRows([r('A', 'B', 91, MON)], people, new Map(), { band: 'match', isCurrent: true, now: NOW })
  eq(row.memberName, 'Alexandra C.', 'member shown as first name + last initial')
  eq(row.matchName, 'Brianna O.', 'match shown as first name + last initial')
  eq(row.memberCity, 'Austin', 'member city shown')
  eq(row.matchCity, 'Round Rock', 'match city shown')
  const blob = JSON.stringify(row)
  ok(!blob.includes('Chen') && !blob.includes('Okafor'), 'no surname reaches the row')

  const route = code('app/api/admin/weekly-pairs/route.ts')
  ok(/shortName\(p\.display_name\)/.test(route), 'the endpoint passes every name through shortName')
  ok(!/select\([^)]*\b(email|phone)\b/.test(route), 'the endpoint never selects an email or phone column')
  ok(/select\('id, display_name, city'\)/.test(route), 'partnership reads are limited to id, display_name, city')
}

// ═══ notified status + channel ═══════════════════════════════════════════════
{
  eq(channelOf({ smsSent: true, emailSent: true }), 'sms+email', 'both channels')
  eq(channelOf({ smsSent: false, emailSent: true }), 'email', 'email only')
  const merged = channelsByPartnership([
    { partnershipId: 'A', smsSent: false, emailSent: true },
    { partnershipId: 'A', smsSent: true, emailSent: false },
  ])
  eq(merged.get('A'), { smsSent: true, emailSent: true }, 'channels merge across the week (a retry can add one)')

  const cur = toPairRows(
    [r('A', 'B', 91, MON, { sms_notified_at: '2026-09-28T14:01:00Z' }), r('B', 'A', 91, MON, { sms_notified_at: null })],
    new Map(), merged, { band: 'match', isCurrent: true, now: NOW })
  eq(cur[0].notified, true, 'current week: stamped → notified')
  eq(cur[0].channel, 'sms+email', 'current week: channel from the events')
  eq(cur[1].notified, false, 'current week: unstamped and no event → not yet')

  const past = toPairRows([r('B', 'A', 91, MON)], new Map(), new Map(), { band: 'match', isCurrent: false, now: NOW })
  eq(past[0].notified, null, 'past week with no event → unknown, never a false "not notified"')

  const rec = toPairRows([r('E', 'F', 79, MON)], new Map(), merged, { band: 'rec', isCurrent: true, now: NOW })
  eq(rec[0].notified, null, 'recommendations are never pinged, so no notified status is claimed')

  const sched = toPairRows([r('A', 'B', 91, MON, { released_at: '2026-10-05T12:00:00Z' })], new Map(), new Map(), { band: 'match', isCurrent: true, now: NOW })
  eq(sched[0].released, false, 'a future release_at is scheduled, not released')
}

// ═══ sort + pagination ═══════════════════════════════════════════════════════
{
  const rows = toPairRows([
    r('A', 'B', 80, '2026-09-28T12:00:00Z'), r('C', 'D', 95, '2026-09-28T12:00:00Z'), r('E', 'F', 99, '2026-09-27T12:00:00Z'),
  ], new Map(), new Map(), { band: 'match', isCurrent: true, now: NOW })
  eq(sortPairRows(rows).map((x) => x.score), [95, 80, 99], 'newest day first; within a day, strongest first')
  // One recompute stamps rows milliseconds apart — write order must not beat score.
  const jitter = toPairRows([
    r('A', 'B', 77, '2026-09-21T12:00:17.900Z'), r('C', 'D', 78, '2026-09-21T12:00:17.100Z'), r('E', 'F', 79, '2026-09-21T12:00:17.500Z'),
  ], new Map(), new Map(), { band: 'rec', isCurrent: true, now: NOW })
  eq(sortPairRows(jitter).map((x) => x.score), [79, 78, 77], 'millisecond jitter within one recompute does not reorder scores')

  const many = Array.from({ length: 1260 }, (_, i) => i)
  const p1 = paginate(many, 1)
  eq([p1.rows.length, p1.pages], [PAIR_PAGE_SIZE, 13], '1,260 rows → 13 pages of 100')
  eq(paginate(many, 13).rows.length, 60, 'the last page holds the remainder')
  eq(paginate(many, 999).page, 13, 'an out-of-range page clamps to the last')
  eq(paginate(many, 0).page, 1, 'page 0 clamps to the first')
  eq(paginate([], 1), { rows: [], page: 1, pages: 1 }, 'an empty week is one empty page')
}

eq(parseBand('match'), 'match', 'band match')
eq(parseBand('rec'), 'rec', 'band rec')
eq(parseBand('plus'), null, 'anything else is refused')

// ═══ THE GATE: a non-admin gets nothing ══════════════════════════════════════
{
  const { isAdminUser } = require('../allowlist')
  ok(!isAdminUser('attacker@example.com'), 'an arbitrary address is not an admin')
  ok(!isAdminUser(''), 'empty email is not an admin')

  const route = read('app/api/admin/weekly-pairs/route.ts')
  ok(/requireAdminRoute\(\)/.test(route), 'the endpoint calls requireAdminRoute')
  ok(route.indexOf('requireAdminRoute()') < route.indexOf('createAdminClient()'),
    'the gate runs BEFORE any admin-client query is constructed')
  ok(/if \(!gate\.ok\) return gate\.response/.test(route), 'a failed gate returns its 401 immediately — no rows')
  ok(!/\.update\(|\.insert\(|\.upsert\(|\.delete\(/.test(code('app/api/admin/weekly-pairs/route.ts')),
    'the endpoint performs NO writes — read-only by construction')

  // Both pages live in the (network) route group, whose layout gates every page.
  for (const p of ['matches', 'recommendations']) {
    ok(existsSync(join(root, `app/admin/(network)/network-performance/${p}/page.tsx`)), `/${p} page is inside the gated (network) group`)
  }
  ok(/await requireAdminPage\(\)/.test(read('app/admin/(network)/layout.tsx')), 'the (network) layout gates with requireAdminPage')
  eq(deriveActive('/admin/network-performance/matches'), 'network-performance', 'drill-down keeps Network Performance active, not Matches')
  eq(deriveActive('/admin/network-performance/recommendations'), 'network-performance', 'recommendations drill-down likewise')
}

// ═══ THE CARD SWAP: nothing can read "Unavailable" ═══════════════════════════
{
  const dash = code('components/admin/network/NetworkPerformanceClient.tsx')
  const cards = code('components/admin/network/cards.tsx')
  const types = code('lib/metrics/types.ts')
  ok(!/Plus Members|Plus Conversion|Meetup Shares/.test(dash), 'the Plus Members, Plus Conversion and Meetup Shares cards are gone')
  ok(!/BlockedCard/.test(dash + cards), 'BlockedCard no longer exists, so no card can render "Unavailable"')
  // Case-insensitive, and over the rendered copy (comments stripped): the first
  // live render still carried "Three metrics are temporarily unavailable" in the
  // info banner, which a capitalised-only check missed.
  ok(!/unavailable/i.test(dash + cards), 'the word "unavailable" (any case) appears nowhere the dashboard renders')
  ok(!/plusMembers|plusConversion|meetupShares|BlockedMetric/.test(types), 'the blocked metrics are gone from the payload type')
  for (const label of ['Active Founding Members', 'Founding Expiring (30d)', 'Departures']) {
    ok(dash.includes(`label="${label}"`), `new card rendered: ${label}`)
  }
  ok(/snapshotMetric\(data, 'activeFoundingMembers'\)/.test(dash) && /snapshotMetric\(data, 'departures'\)/.test(dash),
    'the new cards read real snapshot values, not constants')
  const metrics = code('lib/metrics/getMetrics.ts')
  ok(/eq\('plus_source', 'founding_member_promo'\)/.test(metrics), 'founding counts query the promo population')
  ok(/headCount\(admin, 'account_deletions'\)/.test(metrics), 'departures count the live account_deletions table')

  // Both weekly cards open their lists, carrying the selected week (and scope).
  ok(/matchesGenerated: '\/admin\/network-performance\/matches'/.test(dash), 'Matches Generated card links to its list')
  ok(/recommendationsGenerated: '\/admin\/network-performance\/recommendations'/.test(dash), 'Recommendations Generated card links to its list')
  ok(/week: sel\.weekEnding/.test(dash), 'the link carries the selected reporting week')
}

// ═══ founding counts: comps and the expired are not active ═══════════════════
{
  const now = new Date('2026-09-28T00:00:00Z')
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString()
  const rows = [
    { id: 'a', membership_expires_at: days(120) },
    { id: 'b', membership_expires_at: days(10) },          // expiring soon
    { id: 'c', membership_expires_at: days(FOUNDING_EXPIRY_WINDOW_DAYS) }, // edge: inside the window
    { id: 'd', membership_expires_at: days(-1) },          // expired
    { id: 'e', membership_expires_at: null },              // no term → active, never "expiring"
  ]
  eq(summarizeFoundingActive(rows, null, now), { active: 4, expiringSoon: 2 }, 'active excludes the expired; 30-day window inclusive')
  eq(summarizeFoundingActive(rows, new Set(['a', 'd']), now), { active: 1, expiringSoon: 0 }, 'market scope counts only its partnerships')
}

report('admin/weeklyPairs')
