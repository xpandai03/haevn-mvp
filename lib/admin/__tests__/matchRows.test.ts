/**
 * /admin/matches row logic. Run: npx tsx lib/admin/__tests__/matchRows.test.ts
 * Band boundaries, status derivation, name reduction, market label, and the
 * filter/sort/paginate/counts core (server-side list behaviour).
 */
import {
  bandOf, releaseStatusOf, shortName, marketDisplay,
  filterRows, sortRows, paginate, computeCounts,
  type MatchRow,
} from '../matchRows'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const NOW = '2026-07-23T00:00:00.000Z'

// ── band boundaries (from scoreBands) ────────────────────────────────────────
eq(bandOf(100), 'match', '100 → match')
eq(bandOf(80), 'match', '80 → match')
eq(bandOf(79), 'rec', '79 → rec')
eq(bandOf(77), 'rec', '77 → rec')
eq(bandOf(76), 'below', '76 → below')
eq(bandOf(0), 'below', '0 → below')

// ── release status ───────────────────────────────────────────────────────────
eq(releaseStatusOf('2026-01-01T00:00:00Z', NOW), 'released', 'past release → released')
eq(releaseStatusOf('2099-01-01T00:00:00Z', NOW), 'pending', 'future release → pending')
eq(releaseStatusOf(null, NOW), 'pending', 'null release → pending')

// ── name reduction (PII ≤ old page) ──────────────────────────────────────────
eq(shortName('Alex Chen'), 'Alex C.', 'first + last initial')
eq(shortName('Cher'), 'Cher', 'single name → first only')
eq(shortName('  Mary  Jane  Watson '), 'Mary W.', 'multi-space → first + LAST initial')
eq(shortName(null), null, 'null → null')
eq(shortName(''), null, 'empty → null')

// ── market label ─────────────────────────────────────────────────────────────
const AUS = 'Austin–Round Rock MSA'
eq(marketDisplay(AUS, AUS), AUS, 'both same market → once')
eq(marketDisplay(AUS, 'Portland'), `${AUS} / Portland`, 'mixed → both')
eq(marketDisplay(null, null), 'Unresolved', 'both unresolved → Unresolved')
eq(marketDisplay(AUS, null), `${AUS} / Unresolved`, 'one side unresolved')

// ── row factory ──────────────────────────────────────────────────────────────
function row(o: Partial<MatchRow>): MatchRow {
  return {
    id: 'x', partnershipA: 'aaaa1111', partnershipB: 'bbbb2222',
    nameA: 'Alex C.', nameB: 'Jordan S.', score: 85, band: 'match', tier: null,
    cityA: 'Austin', cityB: 'Austin', marketA: AUS, marketB: AUS,
    computedAt: '2026-07-20T12:00:00Z', releaseAt: '2026-07-20T12:00:00Z', expiresAt: null,
    releaseStatus: 'released', notified: true, saved: false, connection: null, inspectHref: '',
    ...o,
  }
}

// ── filterRows ───────────────────────────────────────────────────────────────
const rows: MatchRow[] = [
  row({ id: '1', score: 90, band: 'match', releaseStatus: 'released', notified: true, marketA: AUS, marketB: AUS }),
  row({ id: '2', score: 78, band: 'rec', releaseStatus: 'pending', notified: false, marketA: AUS, marketB: AUS }),
  row({ id: '3', score: 82, band: 'match', releaseStatus: 'pending', notified: false, marketA: 'Portland', marketB: 'Portland' }),
  row({ id: '4', score: 77, band: 'rec', releaseStatus: 'released', notified: true, marketA: null, marketB: null, nameA: 'Sam W.' }),
]
eq(filterRows(rows, { band: 'match' }).map((r) => r.id), ['1', '3'], 'band=match')
eq(filterRows(rows, { band: 'rec' }).map((r) => r.id), ['2', '4'], 'band=rec')
eq(filterRows(rows, { status: 'released' }).map((r) => r.id), ['1', '4'], 'status=released')
eq(filterRows(rows, { status: 'pending' }).map((r) => r.id), ['2', '3'], 'status=pending')
eq(filterRows(rows, { status: 'notified' }).map((r) => r.id), ['1', '4'], 'status=notified')
eq(filterRows(rows, { market: AUS }).map((r) => r.id), ['1', '2'], 'market=Austin (either side)')
eq(filterRows(rows, { market: 'unresolved' }).map((r) => r.id), ['4'], 'market=unresolved (both null)')
eq(filterRows(rows, { scoreMin: 80 }).map((r) => r.id), ['1', '3'], 'scoreMin=80')
eq(filterRows(rows, { scoreMin: 77, scoreMax: 79 }).map((r) => r.id), ['2', '4'], 'score range = rec band')
eq(filterRows(rows, { search: 'sam' }).map((r) => r.id), ['4'], 'search by name')
eq(filterRows(rows, { search: 'bbbb2222' }).map((r) => r.id).length, 4, 'search by partnership id')
eq(filterRows(rows, { band: 'all', status: 'all', market: 'all' }).length, 4, 'all filters = passthrough')

// ── sortRows ─────────────────────────────────────────────────────────────────
eq(sortRows(rows, 'score', 'desc').map((r) => r.score), [90, 82, 78, 77], 'score desc')
eq(sortRows(rows, 'score', 'asc').map((r) => r.score), [77, 78, 82, 90], 'score asc')
eq(sortRows(rows, 'name', 'asc')[0].nameA, 'Alex C.', 'name asc first = Alex')

// ── paginate ─────────────────────────────────────────────────────────────────
{
  const five = [1, 2, 3, 4, 5].map((n) => row({ id: String(n) }))
  const p2 = paginate(five, 2, 2)
  eq(p2.total, 5, 'paginate total')
  eq(p2.pageRows.map((r) => r.id), ['3', '4'], 'paginate page 2 of size 2')
  eq(paginate(five, 3, 2).pageRows.map((r) => r.id), ['5'], 'paginate last partial page')
}

// ── computeCounts (over the given/filtered set) ──────────────────────────────
{
  const c = computeCounts([
    row({ band: 'match', releaseStatus: 'released', notified: true, connection: 'connected' }),
    row({ band: 'rec', releaseStatus: 'pending', notified: false, connection: null }),
    row({ band: 'match', releaseStatus: 'released', notified: true, connection: 'passed' }),
  ])
  eq(c.matches, 2, 'counts: matches')
  eq(c.recommendations, 1, 'counts: recommendations')
  eq(c.released, 2, 'counts: released')
  eq(c.notified, 2, 'counts: notified')
  eq(c.connected, 1, 'counts: connected (handshake only, not passed)')
}

report('matchRows')
