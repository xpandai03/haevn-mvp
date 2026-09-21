/**
 * Warm-cron configuration.
 *
 * THIS IS NOT IN THE ROUTE FILE ON PURPOSE. A Next.js App Router route module may
 * only export the request handlers and a fixed set of segment config keys
 * (`dynamic`, `maxDuration`, …); any other export fails the build's route-type
 * check. Same family of rule as 'use server' files only exporting async
 * functions — see lib/matches/reportFlag.ts for the sibling case.
 */

/**
 * Soft time budget for one warm invocation.
 *
 * The route's maxDuration is 300s. A generation averages ~12s (measured
 * 2026-09-20), so a run that starts new work at 239s overruns the ceiling and
 * loses the cache write it was in the middle of. Stopping at 240s leaves the
 * in-flight generation room to finish and persist.
 */
export const WARM_SOFT_BUDGET_MS = 240_000

export type WarmCoverage = 'viewers' | 'all'

/**
 * Which directions to warm.
 *
 * 'viewers' (default) — only directions whose viewer has ever signed in: ~683
 *   of 1,208 released, ~$0.93/week on gpt-4o-mini. Everyone else still gets a
 *   report, generated on demand and cached for the next viewer.
 * 'all' — every released direction, ~$2.99/week. One env flip, no code change.
 *
 * This single value is the cost lever for the whole feature; anything above it
 * is rounding.
 */
export function warmCoverage(env: NodeJS.ProcessEnv = process.env): WarmCoverage {
  return env.WARM_COVERAGE === 'all' ? 'all' : 'viewers'
}
