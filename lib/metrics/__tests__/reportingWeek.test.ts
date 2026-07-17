/**
 * Reporting-week math. Run: npx tsx lib/metrics/__tests__/reportingWeek.test.ts
 * Weeks are UTC, Sunday 00:00:00.000 → Saturday 23:59:59.999.
 */
import { currentReportingWeek, priorWeek, weekEnding, weekOf } from '../reportingWeek'
import { eq, ok, report } from './_assert'

// July 2026: Jul 12 = Sun, Jul 18 = Sat (Jul 1 2026 is a Wednesday).
const wed = weekOf(new Date('2026-07-15T12:00:00.000Z')) // a Wednesday
eq(wed.start.toISOString(), '2026-07-12T00:00:00.000Z', 'week start = Sunday 00:00 UTC')
eq(wed.end.toISOString(), '2026-07-18T23:59:59.999Z', 'week end = Saturday 23:59:59.999 UTC')
eq(wed.weekEnding, '2026-07-18', 'weekEnding = the Saturday (YYYY-MM-DD)')

// Sunday start boundary — inclusive.
const sun = weekOf(new Date('2026-07-12T00:00:00.000Z'))
eq(sun.weekEnding, '2026-07-18', 'Sunday 00:00 belongs to its own week')

// Saturday end boundary vs next-day rollover.
eq(weekEnding(new Date('2026-07-18T23:59:59.999Z')), '2026-07-18', 'last ms of Saturday stays in week')
eq(weekEnding(new Date('2026-07-19T00:00:00.000Z')), '2026-07-25', 'Sunday 00:00 rolls to next week')

// Timezone: a Saturday-late-UTC instant is NOT pulled into the local-day week —
// proves UTC fields are used, not local.
eq(weekEnding(new Date('2026-07-19T02:00:00.000Z')), '2026-07-25', 'uses UTC day, not local')

// priorWeek.
const prior = priorWeek(wed)
eq(prior.weekEnding, '2026-07-11', 'priorWeek = previous Saturday')
eq(prior.start.toISOString(), '2026-07-05T00:00:00.000Z', 'priorWeek start = previous Sunday')

// Year rollover: Jan 1 2027 is a Friday → week is 2026-12-27 .. 2027-01-02.
const roll = weekOf(new Date('2027-01-01T09:00:00.000Z'))
eq(roll.start.toISOString(), '2026-12-27T00:00:00.000Z', 'year rollover: start in prior year')
eq(roll.weekEnding, '2027-01-02', 'year rollover: weekEnding in new year')

// currentReportingWeek(now) is deterministic for a fixed now.
const cur = currentReportingWeek(new Date('2026-07-15T12:00:00.000Z'))
eq(cur.weekEnding, '2026-07-18', 'currentReportingWeek respects injected now')

// Every weekEnding is a Saturday (getUTCDay === 6).
for (const iso of ['2026-01-01', '2026-06-30', '2026-12-31', '2027-03-14']) {
  const w = weekOf(new Date(iso + 'T12:00:00.000Z'))
  ok(new Date(w.end).getUTCDay() === 6, `weekEnding for ${iso} is a Saturday`)
}

report('reportingWeek')
