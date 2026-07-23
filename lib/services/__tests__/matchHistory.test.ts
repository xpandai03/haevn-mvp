/**
 * Match-history capture. Run: npx tsx lib/services/__tests__/matchHistory.test.ts
 * buildHistoryRows mapping + captureMatchHistory FAIL-SAFE (never throws; capture
 * failure returns an error but is swallowed by the caller's try/catch).
 */
import {
  buildHistoryRows, captureMatchHistory,
  type ComputedMatchRow, type MatchHistoryRow,
} from '../matchHistory'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const RUN = '2026-07-27'
const cm = (o: Partial<ComputedMatchRow>): ComputedMatchRow => ({
  partnership_a: 'a', partnership_b: 'b', score: 88, tier: 'Gold',
  release_at: '2026-07-27T12:00:00Z', expires_at: '2026-08-10T12:00:00Z', computed_at: '2026-07-27T12:00:00Z', ...o,
})

async function main() {
  // ── buildHistoryRows (pure) ──
  {
    const rows = buildHistoryRows([cm({ partnership_a: 'x', partnership_b: 'y', score: 90, tier: 'Platinum' })], RUN)
    eq(rows.length, 1, 'one row in → one out')
    eq(rows[0].run_date, RUN, 'run_date stamped')
    eq(rows[0].partnership_a, 'x', 'partnership_a mapped')
    eq(rows[0].score, 90, 'score mapped')
    eq(rows[0].tier, 'Platinum', 'tier mapped')
    eq(rows[0].released_at, '2026-07-27T12:00:00Z', 'release_at → released_at')
    eq(buildHistoryRows([], RUN), [], 'empty in → empty out')
  }

  // ── happy path ──
  {
    let received: MatchHistoryRow[] | null = null
    const r = await captureMatchHistory(RUN, {
      fetchComputed: async () => [cm({}), cm({ partnership_a: 'c', partnership_b: 'd', score: 78 })],
      insertHistory: async (rows) => { received = rows; return { error: null } },
    })
    eq(r.captured, 2, 'captured count = rows built')
    ok(!r.error, 'no error on success')
    eq(received!.every((x) => x.run_date === RUN), true, 'insert received rows stamped with run_date')
  }

  // ── empty set → no insert, no error ──
  {
    let called = false
    const r = await captureMatchHistory(RUN, {
      fetchComputed: async () => [],
      insertHistory: async () => { called = true; return { error: null } },
    })
    eq(r.captured, 0, 'empty → captured 0')
    ok(!called, 'empty → insert not called')
  }

  // ── insert error → returned, NOT thrown ──
  {
    let threw = false
    let r: any
    try {
      r = await captureMatchHistory(RUN, {
        fetchComputed: async () => [cm({})],
        insertHistory: async () => ({ error: 'db exploded' }),
      })
    } catch { threw = true }
    ok(!threw, 'insert error does NOT throw')
    eq(r.captured, 0, 'insert error → captured 0')
    eq(r.error, 'db exploded', 'insert error surfaced (for logging, not release)')
  }

  // ── fetch throws → caught, NOT rethrown (release must never break) ──
  {
    let threw = false
    let r: any
    try {
      r = await captureMatchHistory(RUN, {
        fetchComputed: async () => { throw new Error('fetch blew up') },
        insertHistory: async () => ({ error: null }),
      })
    } catch { threw = true }
    ok(!threw, 'fetch throw is caught — capture is fail-safe')
    eq(r.error, 'fetch blew up', 'fetch error surfaced')
  }

  report('matchHistory')
}

main().catch((e) => { console.error(e); process.exit(1) })
