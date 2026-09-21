/**
 * MATCH_REPORT_V2_ENABLED — the full report document.
 *
 * THIS LIVES IN ITS OWN MODULE ON PURPOSE. It cannot sit in
 * lib/matches/getMatchCardData.ts, which carries 'use server': every export of a
 * server-actions file must be an async function, and a synchronous predicate
 * there fails the production build. That rule is build-only — tsc and the test
 * suite both pass — and it is what broke the 2026-09-10 deploy (PR #37 moved
 * UPGRADE_REQUIRED_ERROR out for the same reason).
 *
 * Read server-side only (no NEXT_PUBLIC_ prefix): the value reaches the client
 * as a boolean on the fetched payload, so the flag itself never ships in the
 * bundle. Default OFF — anything but the exact string 'true' keeps the existing
 * five-section expansion, byte-identical.
 */
export function matchReportV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MATCH_REPORT_V2_ENABLED === 'true'
}
