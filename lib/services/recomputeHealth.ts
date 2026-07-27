/**
 * Recompute completeness assessment — the "silent under-run can never happen
 * again" surface. Pure function so it's unit-testable without a DB.
 *
 * Feeds the admin system-status endpoint: given the latest `match_recompute`
 * summary event metadata and the current live-partnership count, decide whether
 * the last Monday run actually covered the full base.
 *
 * Jul 27 2026 failed exactly here: the run was hard-killed at 140/518 and NOTHING
 * downstream fired, so the dashboard showed stale-but-plausible numbers. With
 * this, completed=false OR processed<live lights up the same hour.
 */

export interface RecomputeSummaryMeta {
  partnerships_total?: number | null
  partnerships_processed?: number | null
  partnerships_computed?: number | null
  completed?: boolean
  rows_released_today?: number | null
  finished_at?: string | null
}

export interface RecomputeHealth {
  completed: boolean
  partnershipsTotal: number | null
  partnershipsProcessed: number | null
  partnershipsComputed: number | null
  rowsReleasedToday: number | null
  finishedAt: string | null
  liveCount: number | null
  /** True when the run stopped short OR processed fewer than the live base. */
  underRun: boolean
}

export function assessRecompute(
  meta: RecomputeSummaryMeta | null | undefined,
  liveCount: number | null | undefined,
): RecomputeHealth | null {
  if (!meta) return null
  const total = meta.partnerships_total ?? null
  // If processed wasn't recorded (older events), fall back to total.
  const processed = meta.partnerships_processed ?? total
  const live = liveCount ?? null
  // `completed === false` is an explicit stop-short signal. Absent (older
  // events) we treat it as completed and lean on the processed<live check.
  const completed = meta.completed !== false
  const underRun =
    meta.completed === false ||
    (live != null && processed != null && processed < live)
  return {
    completed,
    partnershipsTotal: total,
    partnershipsProcessed: processed,
    partnershipsComputed: meta.partnerships_computed ?? null,
    rowsReleasedToday: meta.rows_released_today ?? null,
    finishedAt: meta.finished_at ?? null,
    liveCount: live,
    underRun,
  }
}
