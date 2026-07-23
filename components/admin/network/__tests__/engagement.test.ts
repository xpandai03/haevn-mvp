/**
 * Engagement metrics. Run: npx tsx components/admin/network/__tests__/engagement.test.ts
 * Partnership-level login resolution + week boundary (pure helpers), engagementMetric
 * tolerance of pre-PR#9 snapshot rows, and the definitionsVersion constant.
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true } as any)

import { partnershipLoggedInEver, partnershipActiveInWeek } from '../../../../lib/metrics/getMetrics'
import { SNAPSHOT_DEFINITIONS_VERSION, DEFINITIONS_VERSION_NOTES } from '../../../../lib/metrics/definitionsVersion'
import { engagementMetric } from '../derive'
import type { NetworkMetricsPayload } from '../types'
import { eq, ok, report } from '../../../../lib/metrics/__tests__/_assert'

// ── partnership-level login resolution ───────────────────────────────────────
const lsi = new Map<string, string | null>([
  ['a', '2026-07-20T10:00:00.000Z'],
  ['b', null],
  ['c', '2026-07-14T10:00:00.000Z'], // logged in, but a PRIOR week
])
ok(partnershipLoggedInEver(['a', 'b'], lsi), 'couple where A logged in → ever true')
ok(partnershipLoggedInEver(['b', 'a'], lsi), 'order-independent → ever true')
ok(!partnershipLoggedInEver(['b'], lsi), 'solo never-signed-in → ever false')
ok(!partnershipLoggedInEver(['b', 'x'], lsi), 'unknown member id → ever false')
ok(!partnershipLoggedInEver([], lsi), 'no members → ever false')

// ── active-this-week boundary ────────────────────────────────────────────────
const WK_S = '2026-07-19T00:00:00.000Z'
const WK_E = '2026-07-25T23:59:59.999Z'
ok(partnershipActiveInWeek(['a', 'b'], lsi, WK_S, WK_E), 'A signed in 07-20 (in week) → active')
ok(!partnershipActiveInWeek(['c'], lsi, WK_S, WK_E), 'C signed in prior week → not active')
ok(partnershipActiveInWeek(['x'], new Map([['x', WK_E]]), WK_S, WK_E), 'sign-in at week END is in-week')
ok(!partnershipActiveInWeek(['y'], new Map([['y', '2026-07-26T00:00:00.000Z']]), WK_S, WK_E), 'sign-in after week → out')
ok(!partnershipActiveInWeek(['z'], new Map([['z', '2026-07-18T23:59:59.999Z']]), WK_S, WK_E), 'sign-in before week → out')

// ── engagementMetric tolerates pre-PR#9 snapshot rows ────────────────────────
function payload(history: any[], engagement: any): NetworkMetricsPayload {
  return {
    currentWeekEnding: '2026-07-25',
    currentPriorWeekEnding: '2026-07-18',
    metrics: { engagement },
    history,
  } as any as NetworkMetricsPayload
}
{
  const d = payload(
    [
      { snapshot_date: '2026-07-11', metrics: {} }, // OLD row — no engagement key
      { snapshot_date: '2026-07-18', metrics: { engagement: { loggedInEverPartnerships: 35, activeThisWeekPartnerships: 3 } } },
    ],
    { loggedInEverPartnerships: 40, activeThisWeekPartnerships: 2 }
  )
  const li = engagementMetric(d, 'loggedInEverPartnerships')
  eq(li.value, 40, 'loggedIn: live value')
  eq(li.prior, 35, 'loggedIn: prior from currentPriorWeek snapshot')
  eq(li.series, [35, 40], 'loggedIn: OLD row (no engagement) filtered from series; live appended')

  const ac = engagementMetric(d, 'activeThisWeekPartnerships')
  eq(ac.value, 2, 'active: live value')
  eq(ac.prior, 3, 'active: prior from snapshot')
  eq(ac.series, [3, 2], 'active: tolerant series')
}
{
  // all-old history (no engagement anywhere) → series is just the live point, no fake zeros
  const d = payload([{ snapshot_date: '2026-07-18', metrics: {} }], { loggedInEverPartnerships: 40, activeThisWeekPartnerships: 2 })
  const li = engagementMetric(d, 'loggedInEverPartnerships')
  eq(li.prior, null, 'all-old history → prior null (collecting)')
  eq(li.series, [40], 'all-old history → series is single live point (no fake zeros)')
}
{
  // past-week active is null (not computable live) → engagementMetric value null
  const d = payload([], { loggedInEverPartnerships: 40, activeThisWeekPartnerships: null })
  const ac = engagementMetric(d, 'activeThisWeekPartnerships')
  eq(ac.value, null, 'past-week active (null) → value null, no live append')
  eq(ac.series, [], 'past-week active → empty series')
}

// ── definitionsVersion ───────────────────────────────────────────────────────
eq(SNAPSHOT_DEFINITIONS_VERSION, 2, 'definitions version = 2')
ok(!!DEFINITIONS_VERSION_NOTES[1], 'v1 note present')
ok(!!DEFINITIONS_VERSION_NOTES[2], 'v2 note present')

report('engagement')
