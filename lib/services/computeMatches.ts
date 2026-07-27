/**
 * Match Computation Service
 *
 * Calculates and stores compatibility matches in computed_matches table.
 * Called when a user completes onboarding (survey reaches 100%).
 *
 * UNIFIED PIPELINE: Uses calculateCompatibilityFromRaw() — the exact same
 * normalize → score pipeline used by the Connections view (getConnections.ts).
 * Raw answers go in, CompatibilityResult comes out. No separate normalization step.
 *
 * Architecture:
 *   - All candidate data fetched in ~6 bulk queries (no N+1)
 *   - Scoring runs in-memory via calculateCompatibilityFromRaw
 *   - Results batch-upserted in a single write
 *   - Tracks run status in match_compute_runs table
 */

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculateCompatibilityFromRaw,
  type RawAnswers,
  type CompatibilityTier,
} from '@/lib/matching'
import { buildConsoleSnapshot } from '@/lib/matching/consoleSnapshot'

const ENGINE_VERSION = '5cat-v6'
// Matches cutoff: a pair is a "match" at >= 80. Kept for diagnostics/labels.
const MIN_SCORE_THRESHOLD = 80
// Storage floor: we ALSO retain the 77–79 "Recommendations" band so the
// near-miss surface has data. Rows are stored with their real score/tier
// (77–79 = Gold); the >=80 vs 77–79 split is enforced at READ time
// (getComputedMatchCards default minScore=80 vs getRecommendationCards 77–79),
// so band rows never leak into "Your Matches". Nothing below 77 is stored.
const STORE_MIN_SCORE = 77

// Soft wall-clock budget for a full recompute. Both callers (cron +
// run-full-cycle) run under Vercel's 300s hard cap; we stop iterating at 270s
// and record progress-at-death, leaving ~30s for the caller's release phase +
// terminal event. This turns a silent hard-kill into a logged partial. The real
// fix (hoisted ctx, below) keeps a full run well under this — the budget is a
// backstop, not the plan.
const RECOMPUTE_SOFT_BUDGET_MS = 270_000

/**
 * Get the next Monday at 8:00 AM Eastern (12:00 UTC) for Match Monday batching.
 * Matches computed before Monday are held invisible until then.
 *
 * 8 AM ET = 12:00 UTC (EST) or 12:00 UTC (EDT uses 4h offset so 8AM EDT = 12:00 UTC).
 * We use fixed 12:00 UTC which is 8AM EDT / 7AM EST — close enough year-round.
 */
function getNextMonday(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat

  // If it's Monday but before 12:00 UTC (8AM ET), release is today
  let daysUntilMonday: number
  if (day === 1 && now.getUTCHours() < 12) {
    daysUntilMonday = 0
  } else {
    daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day)
  }

  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(12, 0, 0, 0) // 8 AM Eastern
  return nextMonday.toISOString()
}

// =============================================================================
// TYPES
// =============================================================================

export interface PairDiagnostic {
  candidate: string
  score: number
  tier: string
  outcome: 'stored' | 'constraint-failed' | 'below-threshold' | 'no-survey' | 'no-members' | 'handshake' | 'scoring-error'
  reason?: string
  /** Full category + sub-score breakdown (when scoring was performed) */
  breakdown?: any
}

export interface ComputeMatchesResult {
  success: boolean
  matchesComputed: number
  candidatesEvaluated: number
  errors: number
  error?: string
  pairDiagnostics?: PairDiagnostic[]
  upsertError?: string
  _debug?: any // TEMPORARY: debug data embedded in response
}

export interface RecomputeAllResult {
  total: number
  computed: number
  errors: number
  /** Partnerships actually iterated this run (== total when completed). */
  processed?: number
  /** True only if every live partnership was processed (no soft-budget/abort). */
  completed?: boolean
  /** Wall-clock of the run in ms (context build + loop). */
  durationMs?: number
  _debug?: any // TEMPORARY: debug data embedded in response
  details: Array<{
    partnershipId: string
    displayName: string | null
    success: boolean
    matchesComputed: number
    candidatesEvaluated: number
    error?: string
    pairDiagnostics?: PairDiagnostic[]
    upsertError?: string
    _debug?: any // TEMPORARY: per-partnership debug data
  }>
}

// =============================================================================
// SHARED RECOMPUTE CONTEXT (the (a+) fix)
// =============================================================================
//
// The invariant dataset for a full recompute — the entire live base, unchanged
// during the batch. computeMatchesForPartnership normally re-fetches all of this
// on EVERY call (~6 full-table reads × N partnerships), which is the O(N)
// full-scan that timed out the Monday cron. buildRecomputeContext loads it ONCE;
// computeMatchesForPartnership derives its per-partnership inputs from it.
//
// PARITY: this changes only HOW inputs are loaded, never WHAT is computed. The
// same rows feed the same scoring pipeline (calculateCompatibilityFromRaw) with
// the same per-partnership selection semantics. See docs/plans/recompute-timeout-fix.md.

export interface PartnershipRow {
  id: string
  profile_type: string | null
  city: string | null
  msa: string | null
  display_name: string | null
  latitude: number | null
  longitude: number | null
}

export interface RecomputeContext {
  /** All live partnerships, in fetch order — the candidate iteration order. */
  livePartnerships: PartnershipRow[]
  /** Live partnership by id (covers self + every candidate). */
  partnershipsById: Map<string, PartnershipRow>
  /** partnership_id → member user_ids, over the FULL live set INCLUDING self. */
  membersByPartnership: Map<string, string[]>
  /** user_id → survey row, over every live member (self + candidates). */
  surveyByUser: Map<string, { user_id: string; answers_json: any; completion_pct: number }>
  /** partnership_id → resolved display name (diagnostics/labels only). */
  nameByPartnership: Map<string, string>
  /** partnership_id → set of handshake-excluded partnership ids. */
  handshakesByPartnership: Map<string, Set<string>>
}

/**
 * Build the invariant recompute dataset once. Read-only; safe to call against
 * production. Mirrors — exactly — the columns and shapes that
 * computeMatchesForPartnership fetches per call, so ctx-derived inputs are
 * byte-identical to the per-call fetches.
 */
export async function buildRecomputeContext(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<RecomputeContext> {
  // Live partnerships — SAME columns computeMatchesForPartnership selects (L162/L241).
  const { data: partnerships, error } = await adminClient
    .from('partnerships')
    .select('id, profile_type, city, msa, display_name, latitude, longitude')
    .eq('profile_state', 'live')
  if (error || !partnerships) {
    throw new Error(`buildRecomputeContext: partnerships fetch failed: ${error?.message || 'unknown'}`)
  }
  const livePartnerships = partnerships as PartnershipRow[]
  const partnershipsById = new Map(livePartnerships.map(p => [p.id, p]))
  const partnershipIds = livePartnerships.map(p => p.id)

  // Chunked `.in()` — one query over the whole base blows the request URL length
  // limit (a ~500-id list is ~19KB; PostgREST rejects it). Chunking returns the
  // identical row SET and is what makes this scale past the current base.
  const IN_CHUNK = 150
  async function fetchInChunks<T>(
    ids: string[],
    run: (slice: string[]) => PromiseLike<{ data: T[] | null }>
  ): Promise<T[]> {
    const out: T[] = []
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      const { data } = await run(ids.slice(i, i + IN_CHUNK))
      if (data) out.push(...data)
    }
    return out
  }

  // Members for the FULL live set — INCLUDING each partnership itself. The
  // per-call path fetches self's members (L180) separately from candidates'
  // (L272); ctx must cover both so a partnership's own members resolve when it
  // is the "current" one.
  const membersByPartnership = new Map<string, string[]>()
  const allMemberUserIds: string[] = []
  if (partnershipIds.length > 0) {
    const members = await fetchInChunks<{ partnership_id: string; user_id: string }>(
      partnershipIds,
      slice => adminClient.from('partnership_members').select('partnership_id, user_id').in('partnership_id', slice)
    )
    for (const m of members) {
      const arr = membersByPartnership.get(m.partnership_id) || []
      arr.push(m.user_id)
      membersByPartnership.set(m.partnership_id, arr)
      allMemberUserIds.push(m.user_id)
    }
  }

  // Surveys for every live member (self + candidates).
  const surveyByUser = new Map<string, { user_id: string; answers_json: any; completion_pct: number }>()
  if (allMemberUserIds.length > 0) {
    const surveys = await fetchInChunks<{ user_id: string; answers_json: any; completion_pct: number }>(
      allMemberUserIds,
      slice => adminClient.from('user_survey_responses').select('user_id, answers_json, completion_pct').in('user_id', slice)
    )
    for (const s of surveys) surveyByUser.set(s.user_id, s)
  }

  // Name map (diagnostics/labels only — never feeds scoring or stored rows):
  // display_name → profiles.full_name → auth email. Single listUsers page,
  // matching the per-call path exactly.
  const nameByPartnership = new Map<string, string>()
  const profileNameMap = new Map<string, string>()
  if (allMemberUserIds.length > 0) {
    const profiles = await fetchInChunks<{ user_id: string; full_name: string | null }>(
      allMemberUserIds,
      slice => adminClient.from('profiles').select('user_id, full_name').in('user_id', slice)
    )
    for (const p of profiles) if (p.full_name) profileNameMap.set(p.user_id, p.full_name)
  }
  const emailMap = new Map<string, string>()
  const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (authData?.users) for (const u of authData.users) if (u.email) emailMap.set(u.id, u.email)
  for (const p of livePartnerships) {
    if (p.display_name) { nameByPartnership.set(p.id, p.display_name); continue }
    for (const uid of membersByPartnership.get(p.id) || []) {
      const name = profileNameMap.get(uid) || emailMap.get(uid)
      if (name) { nameByPartnership.set(p.id, name); break }
    }
  }

  // Handshakes — build the full exclusion adjacency once. For any partnership X,
  // handshakesByPartnership.get(X) is every partnership handshake-linked to X,
  // identical to the per-call `.or(a.eq.X,b.eq.X)` → "other side" set.
  const handshakesByPartnership = new Map<string, Set<string>>()
  const addExcl = (a: string, b: string) => {
    const s = handshakesByPartnership.get(a) || new Set<string>()
    s.add(b)
    handshakesByPartnership.set(a, s)
  }
  const { data: handshakes } = await adminClient
    .from('handshakes')
    .select('a_partnership, b_partnership')
  if (handshakes) {
    for (const h of handshakes) {
      if (!h.a_partnership || !h.b_partnership) continue
      if (h.a_partnership !== h.b_partnership) {
        addExcl(h.a_partnership, h.b_partnership)
        addExcl(h.b_partnership, h.a_partnership)
      }
    }
  }

  return {
    livePartnerships,
    partnershipsById,
    membersByPartnership,
    surveyByUser,
    nameByPartnership,
    handshakesByPartnership,
  }
}

/**
 * Best-effort progress-at-death breadcrumb. Fires the instant a run stops short
 * (soft budget or exception) so a partial recompute can never be silent — even
 * if the caller is later killed during its release phase. Never throws.
 */
async function emitRecomputeFailed(
  adminClient: ReturnType<typeof createAdminClient>,
  progress: Record<string, any>
) {
  try {
    await adminClient.from('system_events').insert({
      event_type: 'match_recompute_failed',
      triggered_by: 'recompute',
      metadata: { ...progress, at: new Date().toISOString() },
    })
  } catch (e) {
    console.error('[recomputeAllMatches] failed to emit match_recompute_failed:', e)
  }
}

// =============================================================================
// RUN TRACKING HELPERS
// =============================================================================

async function updateRunStatus(
  adminClient: ReturnType<typeof createAdminClient>,
  runId: string | null,
  update: Record<string, any>
) {
  if (!runId) return
  try {
    await adminClient
      .from('match_compute_runs')
      .update(update)
      .eq('id', runId)
  } catch (err) {
    console.warn('[computeMatches] Failed to update run status:', err)
  }
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Compute matches for a single partnership against all other partnerships.
 *
 * Uses calculateCompatibilityFromRaw() — the same atomic normalize+score
 * function used by the Connections live view. Raw DB answers go directly
 * into the scoring pipeline with zero intermediate transformation.
 */
export async function computeMatchesForPartnership(
  partnershipId: string,
  runId: string | null = null,
  ctx?: RecomputeContext
): Promise<ComputeMatchesResult> {
  // In batch mode (ctx present) every invariant read below is served from the
  // in-memory context — zero per-partnership full-table scans. Without ctx the
  // single-partnership callers (survey/save, import-users, computedMatchCards)
  // fetch exactly as before. Scoring is identical in both paths.
  if (!ctx) {
    console.log(`🔥 COMPUTE-FOR-PARTNERSHIP ENTERED — BUILD=2026-03-30T1 id=${partnershipId} engine=${ENGINE_VERSION}`)
    console.log(`[computeMatches] BUILD_MARKER=2026-03-02T1 ENTERED id=${partnershipId} engine=${ENGINE_VERSION}`)
  }

  const adminClient = createAdminClient()
  let matchesComputed = 0
  let candidatesEvaluated = 0
  let errors = 0

  await updateRunStatus(adminClient, runId, {
    status: 'running',
    started_at: new Date().toISOString(),
  })

  try {
    console.log(`[computeMatches] START partnership=${partnershipId}`)

    // =========================================================================
    // 1. Fetch current partnership
    // =========================================================================
    let currentPartnership: PartnershipRow | null
    let currentError: { message?: string } | null = null
    if (ctx) {
      currentPartnership = ctx.partnershipsById.get(partnershipId) ?? null
    } else {
      const res = await adminClient
        .from('partnerships')
        .select('id, profile_type, city, msa, display_name, latitude, longitude')
        .eq('id', partnershipId)
        .single()
      currentPartnership = (res.data as PartnershipRow | null) ?? null
      currentError = res.error
    }

    if (currentError || !currentPartnership) {
      const errMsg = `Partnership not found: ${currentError?.message || 'Unknown error'}`
      console.log(`[computeMatches] EARLY-EXIT: ${errMsg}`)
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    // =========================================================================
    // 2. Fetch current partnership's survey answers
    // =========================================================================
    const currentMembers = ctx
      ? (ctx.membersByPartnership.get(partnershipId) || []).map(user_id => ({ user_id }))
      : (await adminClient
          .from('partnership_members')
          .select('user_id')
          .eq('partnership_id', partnershipId)).data

    if (!currentMembers || currentMembers.length === 0) {
      const errMsg = `Partnership has no members (id=${partnershipId})`
      console.log(`[computeMatches] EARLY-EXIT: ${errMsg}`)
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    const currentMemberIds = currentMembers.map(m => m.user_id)
    // ctx: derive self's surveys from the shared map in member order — same
    // "first completed survey wins" selection the per-call `.in()` + `.find()`
    // makes (and the same the live Connections view uses).
    const currentSurveys = ctx
      ? currentMemberIds
          .map(uid => ctx.surveyByUser.get(uid))
          .filter((s): s is NonNullable<typeof s> => !!s)
      : (await adminClient
          .from('user_survey_responses')
          .select('user_id, answers_json, completion_pct')
          .in('user_id', currentMemberIds)).data

    console.log(`[computeMatches] Survey lookup: members=${currentMemberIds.length} surveys=${currentSurveys?.length ?? 0} completed=${currentSurveys?.filter(s => s.completion_pct >= 100 && s.answers_json).length ?? 0}`)

    const currentCompletedSurvey = currentSurveys?.find(
      s => s.completion_pct >= 100 && s.answers_json
    )

    if (!currentCompletedSurvey?.answers_json) {
      const errMsg = `Partnership has no completed survey (id=${partnershipId}, members=${currentMemberIds.length}, surveys=${currentSurveys?.length ?? 0})`
      console.log(`[computeMatches] EARLY-EXIT: ${errMsg}`)
      if (currentSurveys) {
        for (const s of currentSurveys) {
          console.log(`[computeMatches]   survey: user=${s.user_id} completion=${s.completion_pct}% hasAnswers=${!!s.answers_json}`)
        }
      }
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    // Raw answers — passed directly to calculateCompatibilityFromRaw (no pre-normalization)
    // Inject partnership-level location metadata for distance gate
    const currentRawAnswers: RawAnswers = {
      ...(currentCompletedSurvey.answers_json as RawAnswers),
      ...(currentPartnership.latitude != null && currentPartnership.longitude != null
        ? { _latitude: currentPartnership.latitude, _longitude: currentPartnership.longitude }
        : {}),
    }
    const currentIsCouple = currentPartnership.profile_type === 'couple'

    console.log(`[computeMatches] Current: ${currentPartnership.display_name} | rawKeys=${Object.keys(currentRawAnswers).length} | isCouple=${currentIsCouple}`)

    // =========================================================================
    // 3. Fetch ALL candidate partnerships (live, with display_name)
    // =========================================================================
    let allPartnerships: PartnershipRow[] | null
    let partnershipsError: { message?: string } | null = null
    if (ctx) {
      allPartnerships = ctx.livePartnerships.filter(p => p.id !== partnershipId)
    } else {
      const res = await adminClient
        .from('partnerships')
        .select('id, profile_type, city, msa, display_name, latitude, longitude')
        .neq('id', partnershipId)
        .eq('profile_state', 'live')
      allPartnerships = (res.data as PartnershipRow[] | null) ?? null
      partnershipsError = res.error
    }

    if (partnershipsError) {
      const errMsg = `Failed to fetch partnerships: ${partnershipsError.message}`
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    if (!allPartnerships || allPartnerships.length === 0) {
      console.log(`[computeMatches] No other live partnerships found`)
      await updateRunStatus(adminClient, runId, {
        status: 'success',
        finished_at: new Date().toISOString(),
        candidates_evaluated: 0,
        matches_written: 0,
      })
      return { success: true, matchesComputed: 0, candidatesEvaluated: 0, errors: 0 }
    }

    const candidateIds = allPartnerships.map(p => p.id)
    console.log(`[computeMatches] Found ${allPartnerships.length} live candidates`)

    // =========================================================================
    // 4. Fetch ALL candidate members in one query
    // =========================================================================
    // Candidate members map + name map + surveys + handshakes. In batch mode all
    // of this is served from the shared ctx (no per-partnership reads); the
    // membersByPartnership map covers the full live set but the scoring loop only
    // reads candidate ids, so including self is harmless.
    let allMembers: { partnership_id: string; user_id: string }[] | null = null
    let membersByPartnership: Map<string, string[]>
    const allMemberUserIds: string[] = []
    if (ctx) {
      membersByPartnership = ctx.membersByPartnership
    } else {
      const res = await adminClient
        .from('partnership_members')
        .select('partnership_id, user_id')
        .in('partnership_id', candidateIds)
      allMembers = res.data
      membersByPartnership = new Map<string, string[]>()
      if (allMembers) {
        for (const m of allMembers) {
          const arr = membersByPartnership.get(m.partnership_id) || []
          arr.push(m.user_id)
          membersByPartnership.set(m.partnership_id, arr)
          allMemberUserIds.push(m.user_id)
        }
      }
    }

    // =========================================================================
    // 4b. Candidate name map for diagnostics (display_name → full_name → email)
    // =========================================================================
    let candidateNameMap: Map<string, string>
    if (ctx) {
      candidateNameMap = ctx.nameByPartnership
    } else {
      candidateNameMap = new Map<string, string>()
      if (allMemberUserIds.length > 0) {
        const { data: memberProfiles } = await adminClient
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', allMemberUserIds)
        const profileNameMap = new Map(memberProfiles?.map(p => [p.user_id, p.full_name]) || [])

        const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
        const authEmailMap = new Map<string, string>()
        if (authData?.users) {
          for (const u of authData.users) {
            if (u.email) authEmailMap.set(u.id, u.email)
          }
        }

        for (const [pid, userIds] of membersByPartnership) {
          const partnership = allPartnerships.find(p => p.id === pid)
          if (partnership?.display_name) {
            candidateNameMap.set(pid, partnership.display_name)
            continue
          }
          for (const uid of userIds) {
            const name = profileNameMap.get(uid) || authEmailMap.get(uid)
            if (name) {
              candidateNameMap.set(pid, name)
              break
            }
          }
        }
      }
    }

    // =========================================================================
    // 5. Candidate surveys
    // =========================================================================
    let surveyByUser: Map<string, { user_id?: string; answers_json: any; completion_pct: number }>
    if (ctx) {
      surveyByUser = ctx.surveyByUser
    } else {
      surveyByUser = new Map()
      const { data: allSurveys } = await adminClient
        .from('user_survey_responses')
        .select('user_id, answers_json, completion_pct')
        .in('user_id', allMemberUserIds)
      if (allSurveys) for (const s of allSurveys) surveyByUser.set(s.user_id, s)
    }

    // =========================================================================
    // 6. Existing handshakes for exclusion
    // =========================================================================
    let excludedIds: Set<string>
    if (ctx) {
      excludedIds = ctx.handshakesByPartnership.get(partnershipId) || new Set<string>()
    } else {
      const { data: handshakes } = await adminClient
        .from('handshakes')
        .select('a_partnership, b_partnership')
        .or(`a_partnership.eq.${partnershipId},b_partnership.eq.${partnershipId}`)
      excludedIds = new Set<string>()
      if (handshakes) {
        for (const h of handshakes) {
          if (h.a_partnership !== partnershipId) excludedIds.add(h.a_partnership)
          if (h.b_partnership !== partnershipId) excludedIds.add(h.b_partnership)
        }
      }
    }

    // =========================================================================
    // 7. Score each candidate using the UNIFIED scoring pipeline
    //    calculateCompatibilityFromRaw handles normalization internally —
    //    identical to the Connections view in getConnections.ts
    // =========================================================================
    let noSurvey = 0
    let constraintsFailed = 0
    const pairDiagnostics: PairDiagnostic[] = []
    const matchRows: Array<{
      partnership_a: string
      partnership_b: string
      score: number
      tier: CompatibilityTier
      breakdown: any
      computed_at: string
      engine_version: string
      release_at: string
      expires_at: string
    }> = []

    for (const candidate of allPartnerships) {
      candidatesEvaluated++

      const name = candidate.display_name || candidateNameMap.get(candidate.id) || candidate.id.slice(0, 8)

      // Skip if handshake exists (pending, matched, or dismissed)
      if (excludedIds.has(candidate.id)) {
        pairDiagnostics.push({ candidate: name, candidateId: candidate.id, score: 0, tier: '-', outcome: 'handshake' })
        continue
      }

      // Get candidate's completed survey from in-memory maps
      const memberIds = membersByPartnership.get(candidate.id)
      if (!memberIds || memberIds.length === 0) {
        noSurvey++
        pairDiagnostics.push({ candidate: name, candidateId: candidate.id, score: 0, tier: '-', outcome: 'no-members' })
        continue
      }

      let candidateRawAnswers: RawAnswers | null = null
      for (const uid of memberIds) {
        const survey = surveyByUser.get(uid)
        if (survey && survey.completion_pct >= 100 && survey.answers_json) {
          candidateRawAnswers = survey.answers_json as RawAnswers
          break
        }
      }

      if (!candidateRawAnswers) {
        noSurvey++
        pairDiagnostics.push({ candidate: name, candidateId: candidate.id, score: 0, tier: '-', outcome: 'no-survey', reason: `members=${memberIds.length}` })
        continue
      }

      try {
        const matchIsCouple = candidate.profile_type === 'couple'

        // Inject candidate's location metadata for distance gate
        const candidateRawWithLocation: RawAnswers = {
          ...candidateRawAnswers,
          ...((candidate as any).latitude != null && (candidate as any).longitude != null
            ? { _latitude: (candidate as any).latitude, _longitude: (candidate as any).longitude }
            : {}),
        }

        const result = calculateCompatibilityFromRaw(
          currentRawAnswers,
          candidateRawWithLocation,
          currentIsCouple,
          matchIsCouple
        )

        // Skip if constraints failed
        if (!result.constraints.passed) {
          constraintsFailed++
          pairDiagnostics.push({
            candidate: name,
            candidateId: candidate.id,
            score: result.overallScore,
            tier: result.tier,
            outcome: 'constraint-failed',
            reason: `${result.constraints.blockedBy}: ${result.constraints.reason}`,
            breakdown: result.categories,
          })
          continue
        }

        // Skip only below the STORAGE floor (77). Pairs scoring 77–79 are
        // retained for the Recommendations surface; 80+ are Matches. The split
        // is enforced at read time, so storing the band does not affect Matches.
        if (result.overallScore < STORE_MIN_SCORE) {
          pairDiagnostics.push({
            candidate: name,
            candidateId: candidate.id,
            score: result.overallScore,
            tier: result.tier,
            outcome: 'below-threshold',
            reason: `Score ${result.overallScore} < ${STORE_MIN_SCORE} (storage floor)`,
            breakdown: result.categories,
          })
          continue
        }

        // Store match (both directions)
        const now = new Date().toISOString()
        const releaseAt = getNextMonday()
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        matchRows.push({
          partnership_a: partnershipId,
          partnership_b: candidate.id,
          score: result.overallScore,
          tier: result.tier,
          breakdown: result.categories,
          computed_at: now,
          engine_version: ENGINE_VERSION,
          release_at: releaseAt,
          expires_at: expiresAt,
        })
        matchRows.push({
          partnership_a: candidate.id,
          partnership_b: partnershipId,
          score: result.overallScore,
          tier: result.tier,
          breakdown: result.categories,
          computed_at: now,
          engine_version: ENGINE_VERSION,
          release_at: releaseAt,
          expires_at: expiresAt,
        })

        matchesComputed++
        pairDiagnostics.push({
          candidate: name,
          candidateId: candidate.id,
          score: result.overallScore,
          tier: result.tier,
          outcome: 'stored',
          breakdown: result.categories,
        })

      } catch (matchError: any) {
        errors++
        pairDiagnostics.push({
          candidate: name,
          candidateId: candidate.id,
          score: 0,
          tier: '-',
          outcome: 'scoring-error',
          reason: matchError?.message || String(matchError),
        })
      }
    }

    // =========================================================================
    // 8. Batch upsert all match rows
    // =========================================================================
    let upsertErrorMsg: string | undefined
    if (matchRows.length > 0) {
      console.log(`[computeMatches] Upserting ${matchRows.length} rows (${matchesComputed} pairs)`)
      const { error: upsertError } = await adminClient
        .from('computed_matches')
        .upsert(matchRows, { onConflict: 'partnership_a,partnership_b' })

      if (upsertError) {
        upsertErrorMsg = upsertError.message || JSON.stringify(upsertError)
        console.error(`[computeMatches] Batch upsert FAILED:`, upsertErrorMsg)
        errors += matchRows.length / 2
        matchesComputed = 0
      }
    }

    const summary = `${candidatesEvaluated} evaluated, ${noSurvey} no-survey, ${constraintsFailed} constraints-failed, ${matchRows.length} rows built, ${errors} errors`
    console.log(`[computeMatches] DONE ${currentPartnership.display_name}: ${matchesComputed} matches, ${summary}`)

    await updateRunStatus(adminClient, runId, {
      status: errors > 0 && matchesComputed === 0 ? 'error' : 'success',
      finished_at: new Date().toISOString(),
      candidates_evaluated: candidatesEvaluated,
      matches_written: matchesComputed,
      error_message: errors > 0 ? `${errors} scoring errors` : null,
    })

    const errorMsg = matchesComputed === 0 && candidatesEvaluated > 0
      ? `0 matches: ${summary}${upsertErrorMsg ? ` | UPSERT: ${upsertErrorMsg}` : ''}`
      : errors > 0
        ? `${errors} scoring errors`
        : undefined

    // Log system event (survey completion trigger). Skipped in batch mode: the
    // full recompute emits ONE summary event instead of N per-partnership rows
    // (write-churn trim), and system-status still reads the batch summary.
    if (!ctx) {
      await adminClient.from('system_events').insert({
        event_type: 'match_compute',
        triggered_by: 'survey_complete',
        partnership_id: partnershipId,
        metadata: { computed: matchesComputed, evaluated: candidatesEvaluated, errors }
      }).then(() => {}, () => {})
    }

    return {
      success: true,
      matchesComputed,
      candidatesEvaluated,
      errors,
      error: errorMsg,
      pairDiagnostics,
      upsertError: upsertErrorMsg,
      // Heavy diagnostics only in single-partnership mode. In batch this would
      // be N× the full member map — pure bloat in the returned details[].
      _debug: ctx ? undefined : {
        build: '2026-03-30T3',
        candidateNameMapSize: candidateNameMap.size,
        candidateNameMapEntries: Object.fromEntries([...candidateNameMap.entries()].map(([k, v]) => [k.slice(0, 8), v])),
        allMembersCount: allMembers?.length ?? 'NULL',
        allMemberUserIds: allMemberUserIds.map(u => u.slice(0, 8)),
        membersByPartnershipKeys: [...membersByPartnership.keys()].map(k => k.slice(0, 8)),
      },
    }
  } catch (error: any) {
    console.error(`[computeMatches] Fatal error for partnership ${partnershipId}:`, error)
    await updateRunStatus(adminClient, runId, {
      status: 'error',
      finished_at: new Date().toISOString(),
      error_message: error.message || 'Unknown fatal error',
    })
    return {
      success: false,
      matchesComputed,
      candidatesEvaluated,
      errors,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Recompute matches for all live partnerships.
 */
export async function recomputeAllMatches(): Promise<RecomputeAllResult> {
  console.log(`[recomputeAllMatches] START engine=${ENGINE_VERSION}`)
  const adminClient = createAdminClient()
  const details: RecomputeAllResult['details'] = []
  const runStart = Date.now()

  // ── Build the invariant dataset ONCE (the (a+) fix) ──
  let ctx: RecomputeContext
  try {
    ctx = await buildRecomputeContext(adminClient)
  } catch (err: any) {
    console.error('[recomputeAllMatches] Failed to build context:', err)
    await emitRecomputeFailed(adminClient, {
      reason: 'context_build_failed',
      processed: 0,
      total: 0,
      error: err?.message || String(err),
      elapsed_ms: Date.now() - runStart,
    })
    return { total: 0, computed: 0, errors: 0, processed: 0, completed: false, details: [] }
  }

  const live = ctx.livePartnerships
  const total = live.length
  const ctxMs = Date.now() - runStart
  console.log(`[recomputeAllMatches] ${total} live partnerships; context built in ${ctxMs}ms`)

  let totalComputed = 0
  let totalErrors = 0
  let processed = 0
  let stoppedEarly = false
  let lastPartnershipId: string | null = null

  try {
    for (let i = 0; i < live.length; i++) {
      // Soft-budget backstop: stop before the hard 300s kill so we can record
      // progress-at-death and let the caller release what did compute.
      if (Date.now() - runStart > RECOMPUTE_SOFT_BUDGET_MS) {
        stoppedEarly = true
        console.error(
          `[recomputeAllMatches] SOFT BUDGET hit at ${processed}/${total} after ${Date.now() - runStart}ms — stopping before hard timeout`
        )
        break
      }

      const partnership = live[i]
      lastPartnershipId = partnership.id
      const resolvedName = partnership.display_name || ctx.nameByPartnership.get(partnership.id) || null

      const result = await computeMatchesForPartnership(partnership.id, null, ctx)
      processed++
      totalComputed += result.matchesComputed
      totalErrors += result.errors

      // Resolve pair diagnostic candidate names using the shared name map.
      const resolvedDiagnostics = result.pairDiagnostics?.map(pd => {
        if (pd.candidate && pd.candidate.length === 8 && !pd.candidate.includes(' ')) {
          const full = live.find(p => p.id.startsWith(pd.candidate))
          const resolved = full && ctx.nameByPartnership.get(full.id)
          if (resolved) return { ...pd, candidate: resolved }
        }
        return pd
      })

      details.push({
        partnershipId: partnership.id,
        displayName: resolvedName,
        success: result.success,
        matchesComputed: result.matchesComputed,
        candidatesEvaluated: result.candidatesEvaluated,
        error: result.error,
        pairDiagnostics: resolvedDiagnostics,
        upsertError: result.upsertError,
      })
    }
  } catch (err: any) {
    // A single-partnership fatal is caught inside computeMatchesForPartnership;
    // this only fires if the loop itself throws. Record progress-at-death.
    console.error('[recomputeAllMatches] Loop error:', err)
    await emitRecomputeFailed(adminClient, {
      reason: 'loop_exception',
      processed,
      total,
      last_partnership_id: lastPartnershipId,
      error: err?.message || String(err),
      elapsed_ms: Date.now() - runStart,
    })
    return { total, computed: totalComputed, errors: totalErrors, processed, completed: false, details }
  }

  const durationMs = Date.now() - runStart
  const completed = !stoppedEarly
  console.log(
    `[recomputeAllMatches] DONE processed=${processed}/${total} computed=${totalComputed} errors=${totalErrors} completed=${completed} ${durationMs}ms`
  )

  // Progress-at-death breadcrumb: if we stopped short of the full base, record a
  // failure event NOW — before returning to the caller — so a partial run can
  // never be silent even if the caller is killed during its release phase.
  if (!completed) {
    await emitRecomputeFailed(adminClient, {
      reason: 'soft_budget',
      processed,
      total,
      last_partnership_id: lastPartnershipId,
      elapsed_ms: durationMs,
    })
  }

  // Summary event — ONE row per run (system-status reads the latest match_compute
  // for its "last computation" tile). Replaces the removed per-partnership rows.
  await adminClient.from('system_events').insert({
    event_type: 'match_compute',
    triggered_by: 'admin_manual',
    metadata: { total, computed: totalComputed, errors: totalErrors, processed, completed, duration_ms: durationMs },
  }).then(() => {}, () => {}) // swallow errors — logging should never fail the operation

  // Persist a bounded snapshot of THIS run so the admin console shows the full
  // last run on load (no recompute required) — covers the Monday cron too.
  if (details.length > 0) {
    try {
      const snapshot = buildConsoleSnapshot(
        { total, computed: totalComputed, errors: totalErrors, details },
        { runAt: new Date().toISOString(), triggeredBy: 'recompute' }
      )
      const { data: inserted } = await adminClient
        .from('system_events')
        .insert({
          event_type: 'console_recompute_snapshot',
          triggered_by: 'recompute',
          metadata: snapshot,
        })
        .select('id')
        .single()
      // Keep a single latest snapshot row.
      if (inserted?.id) {
        await adminClient
          .from('system_events')
          .delete()
          .eq('event_type', 'console_recompute_snapshot')
          .neq('id', inserted.id)
      }
    } catch (snapErr) {
      console.warn('[recomputeAllMatches] console snapshot persist skipped:', snapErr)
    }
  }

  return { total, computed: totalComputed, errors: totalErrors, processed, completed, durationMs, details }
}
