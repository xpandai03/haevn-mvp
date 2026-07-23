/**
 * /admin/surveys funnel logic. Run: npx tsx lib/admin/__tests__/surveyRows.test.ts
 */
import {
  surveyStatusOf, inBand, filterSurveys, sortSurveys, median, summarizeSurveys,
  type SurveyRow,
} from '../surveyRows'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── status incl. never-started ───────────────────────────────────────────────
eq(surveyStatusOf(100), 'complete', '100 → complete')
eq(surveyStatusOf(50), 'in_progress', '50 → in progress')
eq(surveyStatusOf(0), 'not_started', '0 → not started')
eq(surveyStatusOf(null), 'not_started', 'null (no survey row) → not started')

// ── in-progress sub-bands ────────────────────────────────────────────────────
ok(inBand(10, 'lt25'), '10 < 25')
ok(inBand(24, 'lt25'), '24 < 25')
ok(!inBand(25, 'lt25'), '25 not <25')
ok(inBand(25, 'mid') && inBand(75, 'mid'), '25 & 75 in mid')
ok(!inBand(76, 'mid'), '76 not mid')
ok(inBand(76, 'gt75') && inBand(99, 'gt75'), '76 & 99 in gt75')
ok(!inBand(100, 'gt75'), '100 (complete) not an in-progress band')
ok(!inBand(null, 'lt25'), 'null pct → no band')

// ── row factory ──────────────────────────────────────────────────────────────
function r(o: Partial<SurveyRow>): SurveyRow {
  return {
    userId: 'u', name: 'Alex Chen', email: 'a@x.com', city: 'Austin', market: 'Austin–Round Rock MSA',
    status: 'complete', completionPct: 100, createdAt: '2026-06-01T00:00:00Z', lastSignInAt: null,
    source: 'webhook', partnershipId: 'p', ...o,
  }
}
const AUS = 'Austin–Round Rock MSA'
const rows: SurveyRow[] = [
  r({ userId: '1', name: 'Alex Chen', status: 'complete', completionPct: 100, lastSignInAt: null, source: 'import', market: AUS }),
  r({ userId: '2', name: 'Bea Lin', status: 'in_progress', completionPct: 20, lastSignInAt: '2026-07-01T00:00:00Z', source: 'webhook', market: AUS }),
  r({ userId: '3', name: 'Cy Ng', status: 'in_progress', completionPct: 60, lastSignInAt: null, source: 'webhook', market: null }),
  r({ userId: '4', name: 'Di Vo', status: 'not_started', completionPct: null, createdAt: null, lastSignInAt: null, source: null, market: AUS }),
]

// ── filter ───────────────────────────────────────────────────────────────────
eq(filterSurveys(rows, { status: 'in_progress' }).map((x) => x.userId), ['2', '3'], 'status=in_progress')
eq(filterSurveys(rows, { status: 'not_started' }).map((x) => x.userId), ['4'], 'never-started visible')
eq(filterSurveys(rows, { band: 'lt25' }).map((x) => x.userId), ['2'], 'band <25')
eq(filterSurveys(rows, { band: 'mid' }).map((x) => x.userId), ['3'], 'band 25–75')
// the re-notify audience: completed but never logged in
eq(filterSurveys(rows, { status: 'complete', login: 'never' }).map((x) => x.userId), ['1'], 'complete + never logged in')
eq(filterSurveys(rows, { source: 'webhook' }).map((x) => x.userId), ['2', '3'], 'source=webhook')
eq(filterSurveys(rows, { market: 'unresolved' }).map((x) => x.userId), ['3'], 'market=unresolved')
eq(filterSurveys(rows, { search: 'bea' }).map((x) => x.userId), ['2'], 'search by name')

// ── sort ─────────────────────────────────────────────────────────────────────
eq(sortSurveys(rows, 'pct', 'desc').map((x) => x.completionPct), [100, 60, 20, null], 'pct desc (null last)')
eq(sortSurveys(rows, 'name', 'asc')[0].name, 'Alex Chen', 'name asc')

// ── median + summary ─────────────────────────────────────────────────────────
eq(median([10, 20, 30]), 20, 'median odd')
eq(median([10, 20]), 15, 'median even (rounded)')
eq(median([]), null, 'median empty → null')
{
  const sm = summarizeSurveys(rows)
  eq(sm.total, 4, 'summary total')
  eq(sm.complete, 1, 'summary complete')
  eq(sm.inProgress, 2, 'summary inProgress')
  eq(sm.neverStarted, 1, 'summary neverStarted (the invisible cohort)')
  eq(sm.medianPctInProgress, 40, 'median of in-progress pct (20,60 → 40)')
}

report('surveyRows')
