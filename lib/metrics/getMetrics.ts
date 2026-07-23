/**
 * getMetrics — the shared metrics query layer for the Network dashboard.
 *
 * Follows the app's data-access idiom: service-role createAdminClient() +
 * Promise.all batching, like app/api/admin/system-status/route.ts. No ORM.
 *
 * SCALE NOTE: ~600 partnerships, 258 computed_matches, most weekly tables are
 * single/low digits. So for market scope we fetch the relevant key columns
 * (with DB-side time/score filters) and intersect against the scope id-set in
 * TS — simpler and obviously-correct at this size, and it sidesteps huge .in()
 * URLs. Network scope uses head:true counts (no row transfer) where trivial.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { MATCH_MIN_SCORE, REC_MIN_SCORE, REC_MAX_SCORE } from '@/lib/matching/scoreBands'
import type { ReportingWeek } from './reportingWeek'
import { resolvePartnershipScope, userIdsForPartnerships } from './scope'
import type {
  Composition,
  CompositionBucket,
  MetricsResult,
  Scope,
  SnapshotMetrics,
  WeeklyMetrics,
} from './types'

type Admin = ReturnType<typeof createAdminClient>

const BLOCKED = {
  plusMembers: {
    blocked: true as const,
    reason:
      'Tier data is known-broken (Lemonsqueezy webhook writes an invalid tier). Deferred to a separate fix.',
  },
  plusConversion: {
    blocked: true as const,
    reason: 'Depends on plusMembers, which is blocked.',
  },
  meetupShares: {
    blocked: true as const,
    reason: 'No meetup-share event is captured anywhere today. Needs instrumentation.',
  },
}

/** True if id is in scope. scopeIds === null means network (everything passes). */
function inScope(id: string | null | undefined, scopeIds: Set<string> | null): boolean {
  if (scopeIds === null) return true
  if (!id) return false
  return scopeIds.has(id)
}

export async function getMetrics(args: {
  scope: Scope
  week: ReportingWeek
}): Promise<MetricsResult> {
  const { scope, week } = args
  const admin = createAdminClient()

  const resolution = await resolvePartnershipScope(scope)
  const scopeIds = resolution.partnershipIds // null = network
  const scopeUserIds = await userIdsForPartnerships(scopeIds)

  const startIso = week.start.toISOString()
  const endIso = week.end.toISOString()

  // ── Snapshot section ──────────────────────────────────────────────────────
  const snapshotP = resolveSnapshot(admin, scopeIds)

  // ── Weekly section ────────────────────────────────────────────────────────
  const weeklyP = resolveWeekly(admin, scopeIds, scopeUserIds, startIso, endIso)

  const [snapshot, weekly] = await Promise.all([snapshotP, weeklyP])

  const partnershipsInScope = scopeIds === null ? snapshot.totalMembers : scopeIds.size

  return {
    scope,
    scopeLabel: resolution.isNetwork ? 'network' : resolution.marketName ?? 'unknown',
    week: { weekEnding: week.weekEnding, start: startIso, end: endIso },
    partnershipsInScope,
    snapshot,
    weekly,
    generatedAt: new Date().toISOString(),
  }
}

async function resolveSnapshot(
  admin: Admin,
  scopeIds: Set<string> | null
): Promise<SnapshotMetrics> {
  const [totalMembers, membersFree, surveys, matchedSet] = await Promise.all([
    // totalMembers — partnerships in scope
    scopeIds === null
      ? headCount(admin, 'partnerships')
      : Promise.resolve(scopeIds.size),

    // membersFree — partnerships with membership_tier = 'free'
    scopeIds === null
      ? headCount(admin, 'partnerships', (q) => q.eq('membership_tier', 'free'))
      : countFetchedInScope(admin, 'partnerships', 'id', scopeIds, (q) =>
          q.eq('membership_tier', 'free')
        ),

    // surveys — RESOLVED (PR #6): keyed to completion_pct >= 100 (partnership
    // unit), not profiles.survey_complete. The boolean lagged because only the
    // webhook path set it; see docs/investigations/survey-count-reconciliation.md.
    surveyCounts(admin, scopeIds),

    // matched partnership ids (from computed_matches, any score/time) — for noCurrentMatch
    matchedPartnershipIds(admin),
  ])

  const matchedInScope =
    scopeIds === null
      ? matchedSet.size
      : [...scopeIds].filter((id) => matchedSet.has(id)).length

  const noCurrentMatch = Math.max(0, totalMembers - matchedInScope)

  return {
    totalMembers,
    completedSurveys: surveys.complete,
    incompleteSurveys: surveys.incomplete,
    membersFree,
    noCurrentMatch,
    plusMembers: BLOCKED.plusMembers,
    plusConversion: BLOCKED.plusConversion,
    meetupShares: BLOCKED.meetupShares,
  }
}

async function resolveWeekly(
  admin: Admin,
  scopeIds: Set<string> | null,
  scopeUserIds: Set<string> | null,
  startIso: string,
  endIso: string
): Promise<WeeklyMetrics> {
  const [
    matchesGenerated,
    recommendationsGenerated,
    nudgesSent,
    readyToMeetSignals,
    newConnections,
    conversationsStarted,
  ] = await Promise.all([
    // Matches: computed_matches score >= 80, computed_at in week, scoped on partnership_a
    countFetchedInScope(admin, 'computed_matches', 'partnership_a', scopeIds, (q) =>
      q.gte('score', MATCH_MIN_SCORE).gte('computed_at', startIso).lte('computed_at', endIso)
    ),
    // Recommendations: score in [77, 79], computed_at in week
    countFetchedInScope(admin, 'computed_matches', 'partnership_a', scopeIds, (q) =>
      q
        .gte('score', REC_MIN_SCORE)
        .lte('score', REC_MAX_SCORE)
        .gte('computed_at', startIso)
        .lte('computed_at', endIso)
    ),
    // Nudges: user-keyed (sender_id), created_at in week
    countFetchedInScope(admin, 'nudges', 'sender_id', scopeUserIds, (q) =>
      q.gte('created_at', startIso).lte('created_at', endIso)
    ),
    // Ready-to-meet: partnership-keyed (signaller_partnership_id), created_at in week
    countFetchedInScope(
      admin,
      'ready_to_meet_signals',
      'signaller_partnership_id',
      scopeIds,
      (q) => q.gte('created_at', startIso).lte('created_at', endIso)
    ),
    // New connections: handshakes, in scope if EITHER partnership is in scope
    countEitherInScope(
      admin,
      'handshakes',
      'a_partnership',
      'b_partnership',
      scopeIds,
      startIso,
      endIso
    ),
    // Conversations started: user-keyed, in scope if EITHER participant is in scope
    countEitherInScope(
      admin,
      'conversations',
      'participant1_id',
      'participant2_id',
      scopeUserIds,
      startIso,
      endIso
    ),
  ])

  return {
    matchesGenerated,
    recommendationsGenerated,
    nudgesSent,
    readyToMeetSignals,
    newConnections,
    conversationsStarted,
  }
}

// ── Query helpers ───────────────────────────────────────────────────────────

type Filter = (q: any) => any

/** Head-count a table with optional filters (no row transfer). */
async function headCount(admin: Admin, table: string, apply?: Filter): Promise<number> {
  let q: any = admin.from(table).select('*', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count } = await q
  return count ?? 0
}

/**
 * Count rows matching `apply`, restricted to scope. scopeIds === null (network)
 * uses a head count; otherwise we fetch the scope column and intersect in TS.
 */
async function countFetchedInScope(
  admin: Admin,
  table: string,
  scopeCol: string,
  scopeIds: Set<string> | null,
  apply: Filter
): Promise<number> {
  if (scopeIds === null) return headCount(admin, table, apply)
  if (scopeIds.size === 0) return 0
  let q: any = admin.from(table).select(scopeCol)
  q = apply(q).limit(100000)
  const { data } = await q
  let n = 0
  for (const r of (data ?? []) as any[]) if (scopeIds.has(r[scopeCol])) n++
  return n
}

/** Count rows where EITHER of two scope columns is in scope (handshakes/conversations). */
async function countEitherInScope(
  admin: Admin,
  table: string,
  colA: string,
  colB: string,
  scopeIds: Set<string> | null,
  startIso: string,
  endIso: string
): Promise<number> {
  if (scopeIds !== null && scopeIds.size === 0) return 0
  if (scopeIds === null) {
    return headCount(admin, table, (q) =>
      q.gte('created_at', startIso).lte('created_at', endIso)
    )
  }
  const { data } = await admin
    .from(table)
    .select(`${colA}, ${colB}`)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .limit(100000)
  let n = 0
  for (const r of (data ?? []) as any[]) {
    if (scopeIds.has(r[colA]) || scopeIds.has(r[colB])) n++
  }
  return n
}

/** Distinct partnership ids appearing in computed_matches (as a or b). */
async function matchedPartnershipIds(admin: Admin): Promise<Set<string>> {
  const set = new Set<string>()
  const { data } = await admin
    .from('computed_matches')
    .select('partnership_a, partnership_b')
    .limit(100000)
  for (const r of (data ?? []) as { partnership_a: string; partnership_b: string }[]) {
    set.add(r.partnership_a)
    set.add(r.partnership_b)
  }
  return set
}

/** completed / incomplete survey counts, person-level, scoped to users. */
/**
 * Survey-completeness boundary — the SINGLE source of truth for the metric,
 * resolved by docs/investigations/survey-count-reconciliation.md (PR #6):
 * completion_pct >= 100 is "complete" (path-independent, no webhook lag), and
 * survey_reviewed does NOT gate it. Kept as pure exported helpers so the market
 * path and the tests share one definition.
 */
export const SURVEY_COMPLETE_MIN_PCT = 100

/** Survey is complete (finished). */
export function isSurveyComplete(pct: number | null | undefined): boolean {
  return pct != null && pct >= SURVEY_COMPLETE_MIN_PCT
}

/** Survey is started-but-unfinished (1–99). "Never started" (0/null) is neither. */
export function isSurveyStarted(pct: number | null | undefined): boolean {
  return pct != null && pct >= 1 && pct < SURVEY_COMPLETE_MIN_PCT
}

/**
 * Completed / incomplete surveys, keyed to the member unit (partnership) via
 * user_survey_responses.completion_pct. Completed = completion_pct >= 100;
 * incomplete = started-but-unfinished (1–99); "never started" (no row, or pct
 * 0/null) is intentionally in NEITHER bucket (flagged in the investigation for a
 * future product decision). Replaces the old profiles.survey_complete boolean,
 * which lagged because only the webhook path set it (see PR #6).
 */
async function surveyCounts(
  admin: Admin,
  scopeIds: Set<string> | null
): Promise<{ complete: number; incomplete: number }> {
  if (scopeIds === null) {
    const [complete, incomplete] = await Promise.all([
      headCount(admin, 'user_survey_responses', (q) =>
        q.gte('completion_pct', SURVEY_COMPLETE_MIN_PCT)
      ),
      headCount(admin, 'user_survey_responses', (q) =>
        q.gte('completion_pct', 1).lt('completion_pct', SURVEY_COMPLETE_MIN_PCT)
      ),
    ])
    return { complete, incomplete }
  }
  if (scopeIds.size === 0) return { complete: 0, incomplete: 0 }
  // user_survey_responses is 1:1 with partnerships (partnership_id populated);
  // fetch the small table once and bucket by partnership scope.
  const { data } = await admin
    .from('user_survey_responses')
    .select('partnership_id, completion_pct')
    .limit(100000)
  let complete = 0
  let incomplete = 0
  for (const r of (data ?? []) as { partnership_id: string | null; completion_pct: number | null }[]) {
    if (!r.partnership_id || !scopeIds.has(r.partnership_id)) continue
    if (isSurveyComplete(r.completion_pct)) complete++
    else if (isSurveyStarted(r.completion_pct)) incomplete++
  }
  return { complete, incomplete }
}

// ── Composition (via the SQL RPC) ───────────────────────────────────────────

const EMPTY_COMPOSITION: Composition = {
  gender: [],
  orientation: [],
  relationshipIntent: [],
  age: [],
}

/**
 * getComposition — one RPC call feeds all four charts. The RPC applies the same
 * city→market scope join in SQL. Zero partnerships → zero rows → empty arrays
 * (not an error). A genuine RPC error (e.g. migration not applied) throws.
 */
export async function getComposition(args: { scope: Scope }): Promise<Composition> {
  const { scope } = args
  const admin = createAdminClient()
  const pMarket = scope === 'network' ? null : scope.market

  const { data, error } = await admin.rpc('get_composition_breakdown', { p_market: pMarket })
  if (error) {
    throw new Error(`get_composition_breakdown failed: ${error.message}`)
  }

  const out: Composition = {
    gender: [],
    orientation: [],
    relationshipIntent: [],
    age: [],
  }
  const dimensionMap: Record<string, keyof Composition> = {
    gender: 'gender',
    orientation: 'orientation',
    relationship_intent: 'relationshipIntent',
    age: 'age',
  }
  for (const row of (data ?? []) as CompositionBucket[]) {
    const key = dimensionMap[row.dimension]
    if (!key) continue // unknown dimension — ignore defensively
    out[key].push({ dimension: row.dimension, bucket: row.bucket, count: Number(row.count) })
  }
  // Deterministic order for stable snapshots: count desc, then bucket asc.
  for (const k of Object.keys(out) as (keyof Composition)[]) {
    out[k].sort((a, b) => b.count - a.count || a.bucket.localeCompare(b.bucket))
  }
  return Object.values(out).some((v) => v.length) ? out : EMPTY_COMPOSITION
}
