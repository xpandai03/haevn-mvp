/**
 * Per-route request ceilings for /api/goose/*, applied AFTER auth (an
 * unauthenticated flood can never spend the partner's budget).
 *
 * In-process sliding window, per function instance. There is one caller (the
 * event partner, bearer-authenticated), so this is a runaway-loop guard, not
 * abuse control. Ceilings are set well above the contract's usage: status is
 * polled ~every 5s per event in the T-1 window. Fluid Compute reuses instances,
 * so a ceiling holds across most requests; a cold instance starts fresh, which
 * only ever errs toward allowing. Platform-wide limits are the Vercel WAF's job.
 */

export type GooseRouteClass = 'create_cohort' | 'associate' | 'finalize' | 'status' | 'results'

/** Requests per 60s window, per instance. Published to the partner in the implementer notes. */
export const GOOSE_RATE_LIMITS: Record<GooseRouteClass, number> = {
  create_cohort: 60,
  associate: 600,
  finalize: 30,
  status: 600,
  results: 300,
}

const WINDOW_MS = 60_000
const hits = new Map<GooseRouteClass, number[]>()

/** Returns null when allowed, or the seconds to wait when over the ceiling. */
export function takeGooseRateToken(cls: GooseRouteClass, now: number = Date.now()): number | null {
  const arr = (hits.get(cls) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= GOOSE_RATE_LIMITS[cls]) {
    hits.set(cls, arr)
    return Math.max(1, Math.ceil((WINDOW_MS - (now - arr[0])) / 1000))
  }
  arr.push(now)
  hits.set(cls, arr)
  return null
}

/** Tests only. */
export function resetGooseRateLimits(): void {
  hits.clear()
}
