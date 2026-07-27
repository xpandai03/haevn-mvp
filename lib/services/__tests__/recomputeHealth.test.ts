/**
 * Recompute completeness contract. Run: npx tsx lib/services/__tests__/recomputeHealth.test.ts
 *
 * The observability guarantee: a run that stopped short of the full base is
 * NEVER silent — assessRecompute flags underRun from either the explicit
 * `completed:false` signal or processed < live count. This is the check that
 * would have caught Jul 27 2026 (140/518, hard-killed) the same hour.
 */
import { assessRecompute } from '../recomputeHealth'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

function main() {
  // ── null in → null out ──
  eq(assessRecompute(null, 519), null, 'no event → null')
  eq(assessRecompute(undefined, 519), null, 'undefined meta → null')

  // ── healthy full run ──
  {
    const h = assessRecompute(
      { partnerships_total: 519, partnerships_processed: 519, partnerships_computed: 474, completed: true, rows_released_today: 206 },
      519,
    )!
    ok(h.completed, 'completed=true surfaced')
    ok(!h.underRun, 'full run is NOT an under-run')
    eq(h.partnershipsProcessed, 519, 'processed surfaced')
    eq(h.liveCount, 519, 'live count surfaced')
  }

  // ── the Jul 27 shape: explicit completed=false ──
  {
    const h = assessRecompute(
      { partnerships_total: 518, partnerships_processed: 140, completed: false },
      518,
    )!
    ok(!h.completed, 'completed=false surfaced')
    ok(h.underRun, 'stopped-short run IS an under-run (explicit flag)')
  }

  // ── under-run detected by processed < live even if completed flag missing ──
  {
    const h = assessRecompute(
      { partnerships_total: 519, partnerships_processed: 300 }, // older event, no `completed`
      519,
    )!
    ok(h.completed, 'absent completed flag treated as completed…')
    ok(h.underRun, '…but processed < live still flags under-run')
  }

  // ── legacy event with no processed count: fall back to total, not a false alarm ──
  {
    const h = assessRecompute(
      { partnerships_total: 519, completed: true }, // pre-fix event, no partnerships_processed
      519,
    )!
    eq(h.partnershipsProcessed, 519, 'missing processed falls back to total')
    ok(!h.underRun, 'legacy complete run is not a false under-run')
  }

  // ── live count unknown: cannot compare, but explicit completed=false still fires ──
  {
    const okRun = assessRecompute({ partnerships_total: 519, partnerships_processed: 519, completed: true }, null)!
    ok(!okRun.underRun, 'unknown live count + completed → no under-run')
    const badRun = assessRecompute({ partnerships_total: 519, partnerships_processed: 10, completed: false }, null)!
    ok(badRun.underRun, 'unknown live count still flags explicit completed=false')
  }

  report('recomputeHealth')
}

main()
