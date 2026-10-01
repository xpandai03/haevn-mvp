/**
 * Matching exclusion: `partnerships.matching_excluded` (migration 061).
 *
 * A flagged partnership is a fully working signed-in member (dashboard,
 * profile, messages, upgrade flow all behave normally) that is never matched
 * WITH anyone and never receives a bulk or match-driven communication. It
 * exists for operator accounts such as payment-processor underwriting logins.
 *
 * WHY A COLUMN AND NOT `profile_state`. `profile_state` is rewritten to 'live'
 * by every survey save, ingest, and first photo upload, and middleware keys
 * partnership selection on it. Reusing it would neither stay put nor leave the
 * account usable. Nothing in the app writes `matching_excluded`; it changes
 * only by an operator UPDATE, so it cannot be silently undone.
 *
 * Enforced at (keep this list in sync when adding an audience):
 *   compute     lib/services/computeMatches.ts (batch pool, per-call pool, self)
 *   release     lib/markets/releaseGate.ts getReleaseEligibility (cron release,
 *               admin trigger-release, Monday notify-matches)
 *   ping        lib/notify/noMatchAudience.ts
 *   re-notify   lib/renotify/audience.ts
 *   read path   lib/actions/computedMatchCards.ts, lib/services/discovery.ts
 *   backstop    lib/services/notifications.ts sendNotification
 */

export const MATCHING_EXCLUDED_COLUMN = 'matching_excluded'

/** True only for an explicit `true`. A missing or null value is not excluded. */
export function isMatchingExcluded(
  row: { matching_excluded?: boolean | null } | null | undefined
): boolean {
  return row?.matching_excluded === true
}
