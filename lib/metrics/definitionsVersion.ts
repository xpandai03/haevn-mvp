/**
 * Snapshot definitions version — stamped into each network_snapshots.metrics row
 * so a reader can tell which metric definitions produced it (approved from PR #7's
 * proposal). Immutable history: old rows have no field → treat as v1.
 *
 * Bump this ONLY when a change alters what an existing metric counts, and add a
 * note below. WoW readers can then flag a one-time jump across a version boundary
 * instead of reporting it as real movement.
 */
export const SNAPSHOT_DEFINITIONS_VERSION = 2

export const DEFINITIONS_VERSION_NOTES: Record<number, string> = {
  1: 'Pre-PR#7: completedSurveys/incompleteSurveys from the profiles.survey_complete boolean.',
  2: 'PR#7: surveys keyed to user_survey_responses.completion_pct. PR#9: adds engagement metrics (logged-in-ever, active-this-week).',
}
