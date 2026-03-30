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

const ENGINE_VERSION = '5cat-v6'
const MIN_SCORE_THRESHOLD = 80

/**
 * Get the next Monday at 00:00 UTC for Match Monday batching.
 * Matches computed before Monday are held invisible until then.
 */
function getNextMonday(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : (8 - day)
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
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
  runId: string | null = null
): Promise<ComputeMatchesResult> {
  console.log(`🔥 COMPUTE-FOR-PARTNERSHIP ENTERED — BUILD=2026-03-30T1 id=${partnershipId} engine=${ENGINE_VERSION}`)
  console.log(`[computeMatches] BUILD_MARKER=2026-03-02T1 ENTERED id=${partnershipId} engine=${ENGINE_VERSION}`)

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
    const { data: currentPartnership, error: currentError } = await adminClient
      .from('partnerships')
      .select('id, profile_type, city, msa, display_name, latitude, longitude')
      .eq('id', partnershipId)
      .single()

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
    const { data: currentMembers } = await adminClient
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)

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
    const { data: currentSurveys } = await adminClient
      .from('user_survey_responses')
      .select('user_id, answers_json, completion_pct')
      .in('user_id', currentMemberIds)

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
    const { data: allPartnerships, error: partnershipsError } = await adminClient
      .from('partnerships')
      .select('id, profile_type, city, msa, display_name, latitude, longitude')
      .neq('id', partnershipId)
      .eq('profile_state', 'live')

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
    const { data: allMembers } = await adminClient
      .from('partnership_members')
      .select('partnership_id, user_id')
      .in('partnership_id', candidateIds)

    const membersByPartnership = new Map<string, string[]>()
    const allMemberUserIds: string[] = []
    if (allMembers) {
      for (const m of allMembers) {
        const arr = membersByPartnership.get(m.partnership_id) || []
        arr.push(m.user_id)
        membersByPartnership.set(m.partnership_id, arr)
        allMemberUserIds.push(m.user_id)
      }
    }

    // ===== STEP 1: Log raw inputs =====
    console.log(`[DEBUG-STEP1] candidateIds count: ${candidateIds.length}`)
    console.log(`[DEBUG-STEP1] allMembers count: ${allMembers?.length ?? 'NULL'}`)
    console.log(`[DEBUG-STEP1] allMemberUserIds: ${JSON.stringify(allMemberUserIds)}`)
    console.log(`[DEBUG-STEP1] membersByPartnership keys: ${JSON.stringify([...membersByPartnership.keys()].map(k => k.slice(0, 8)))}`)

    // =========================================================================
    // 4b. Build candidate name map for diagnostics (display_name → full_name → email)
    // =========================================================================
    const candidateNameMap = new Map<string, string>()
    if (allMemberUserIds.length > 0) {
      const { data: memberProfiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allMemberUserIds)

      // ===== STEP 2: Log profiles query result =====
      console.log(`[DEBUG-STEP2] profiles query error: ${JSON.stringify(profilesError)}`)
      console.log(`[DEBUG-STEP2] profiles result count: ${memberProfiles?.length ?? 'NULL'}`)
      console.log(`[DEBUG-STEP2] profiles data: ${JSON.stringify(memberProfiles?.map(p => ({ uid: p.user_id.slice(0, 8), name: p.full_name })))}`)

      const profileNameMap = new Map(memberProfiles?.map(p => [p.user_id, p.full_name]) || [])

      // Also fetch auth emails as final fallback
      const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const authEmailMap = new Map<string, string>()
      if (authData?.users) {
        for (const u of authData.users) {
          if (u.email) authEmailMap.set(u.id, u.email)
        }
      }

      // ===== STEP 3: Log auth users result =====
      console.log(`[DEBUG-STEP3] auth users count: ${authData?.users?.length ?? 'NULL'}`)
      console.log(`[DEBUG-STEP3] authEmailMap size: ${authEmailMap.size}`)
      console.log(`[DEBUG-STEP3] authEmailMap entries: ${JSON.stringify(Object.fromEntries([...authEmailMap.entries()].map(([k, v]) => [k.slice(0, 8), v])))}`)

      // Map partnership_id → best available name
      for (const [pid, userIds] of membersByPartnership) {
        // Check display_name first (from allPartnerships)
        const partnership = allPartnerships.find(p => p.id === pid)

        // ===== STEP 4: Log each mapping attempt =====
        console.log(`[DEBUG-STEP4] pid=${pid.slice(0, 8)}: display_name=${JSON.stringify(partnership?.display_name)}, userIds=${JSON.stringify(userIds.map(u => u.slice(0, 8)))}`)
        for (const uid of userIds) {
          console.log(`[DEBUG-STEP4]   uid=${uid.slice(0, 8)}: profileNameMap.get=${JSON.stringify(profileNameMap.get(uid))}, authEmailMap.get=${JSON.stringify(authEmailMap.get(uid))}`)
        }

        if (partnership?.display_name) {
          candidateNameMap.set(pid, partnership.display_name)
          continue
        }
        // Then profiles.full_name, then auth email
        for (const uid of userIds) {
          const name = profileNameMap.get(uid) || authEmailMap.get(uid)
          if (name) {
            candidateNameMap.set(pid, name)
            break
          }
        }
      }
    } else {
      console.log(`[DEBUG-STEP1] ⚠️ allMemberUserIds is EMPTY — skipping name resolution entirely`)
    }

    // ===== STEP 5: Final candidateNameMap =====
    console.log(`[DEBUG-STEP5] candidateNameMap size: ${candidateNameMap.size}`)
    console.log(`[DEBUG-STEP5] candidateNameMap: ${JSON.stringify(Object.fromEntries([...candidateNameMap.entries()].map(([k, v]) => [k.slice(0, 8), v])))}`)

    // =========================================================================
    // 5. Fetch ALL candidate surveys in one query
    // =========================================================================
    const { data: allSurveys } = await adminClient
      .from('user_survey_responses')
      .select('user_id, answers_json, completion_pct')
      .in('user_id', allMemberUserIds)

    const surveyByUser = new Map<string, { answers_json: any; completion_pct: number }>()
    if (allSurveys) {
      for (const s of allSurveys) {
        surveyByUser.set(s.user_id, s)
      }
    }

    // =========================================================================
    // 6. Fetch existing handshakes for exclusion
    // =========================================================================
    const { data: handshakes } = await adminClient
      .from('handshakes')
      .select('a_partnership, b_partnership')
      .or(`a_partnership.eq.${partnershipId},b_partnership.eq.${partnershipId}`)

    const excludedIds = new Set<string>()
    if (handshakes) {
      for (const h of handshakes) {
        if (h.a_partnership !== partnershipId) excludedIds.add(h.a_partnership)
        if (h.b_partnership !== partnershipId) excludedIds.add(h.b_partnership)
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
      console.log(`[DIAG-NAME] candidate ${candidate.id.slice(0, 8)}: display_name=${JSON.stringify(candidate.display_name)}, candidateNameMap.get=${JSON.stringify(candidateNameMap.get(candidate.id))}, resolved=${JSON.stringify(name)}`)

      // Skip if handshake exists (pending, matched, or dismissed)
      if (excludedIds.has(candidate.id)) {
        pairDiagnostics.push({ candidate: name, score: 0, tier: '-', outcome: 'handshake' })
        continue
      }

      // Get candidate's completed survey from in-memory maps
      const memberIds = membersByPartnership.get(candidate.id)
      if (!memberIds || memberIds.length === 0) {
        noSurvey++
        pairDiagnostics.push({ candidate: name, score: 0, tier: '-', outcome: 'no-members' })
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
        pairDiagnostics.push({ candidate: name, score: 0, tier: '-', outcome: 'no-survey', reason: `members=${memberIds.length}` })
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

        console.log(`[PAIR-RESULT] ${currentPartnership.display_name} vs ${name}: score=${result.overallScore} tier=${result.tier} constraints=${result.constraints.passed}`)

        // Skip if constraints failed
        if (!result.constraints.passed) {
          constraintsFailed++
          pairDiagnostics.push({
            candidate: name,
            score: result.overallScore,
            tier: result.tier,
            outcome: 'constraint-failed',
            reason: `${result.constraints.blockedBy}: ${result.constraints.reason}`,
          })
          continue
        }

        // Skip if below minimum score threshold
        if (result.overallScore < MIN_SCORE_THRESHOLD) {
          pairDiagnostics.push({
            candidate: name,
            score: result.overallScore,
            tier: result.tier,
            outcome: 'below-threshold',
            reason: `Score ${result.overallScore} < ${MIN_SCORE_THRESHOLD}`,
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
          score: result.overallScore,
          tier: result.tier,
          outcome: 'stored',
        })

      } catch (matchError: any) {
        errors++
        pairDiagnostics.push({
          candidate: name,
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

    return {
      success: true,
      matchesComputed,
      candidatesEvaluated,
      errors,
      error: errorMsg,
      pairDiagnostics,
      upsertError: upsertErrorMsg,
      _debug: {
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
  console.log(`🔥 RECOMPUTE-ALL ENTERED — computeMatches.ts BUILD=2026-03-30T1 engine=${ENGINE_VERSION}`)
  console.log(`[recomputeAllMatches] BUILD_MARKER=2026-03-02T1 engine=${ENGINE_VERSION}`)
  const adminClient = createAdminClient()
  const details: RecomputeAllResult['details'] = []

  try {
    const { data: allPartnerships, error } = await adminClient
      .from('partnerships')
      .select('id, display_name')
      .eq('profile_state', 'live')

    if (error || !allPartnerships) {
      console.error('[recomputeAllMatches] Failed to fetch partnerships:', error)
      return { total: 0, computed: 0, errors: 0, details: [] }
    }

    // Build a name lookup map: partnership_id → resolved name
    // Fallback chain: display_name → profiles.full_name → email
    const partnershipIds = allPartnerships.map(p => p.id)
    const { data: allMembers } = await adminClient
      .from('partnership_members')
      .select('partnership_id, user_id')
      .in('partnership_id', partnershipIds)

    const nameMap = new Map<string, string>()
    if (allMembers && allMembers.length > 0) {
      const memberUserIds = allMembers.map(m => m.user_id)

      // Get names from profiles
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', memberUserIds)
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || [])

      // Get emails from auth.users for fallback
      const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = new Map<string, string>()
      if (authData?.users) {
        for (const u of authData.users) {
          if (u.email) emailMap.set(u.id, u.email)
        }
      }

      for (const m of allMembers) {
        if (nameMap.has(m.partnership_id)) continue
        const name = profileMap.get(m.user_id) || emailMap.get(m.user_id) || null
        if (name) nameMap.set(m.partnership_id, name)
      }
    }

    // ===== DIAGNOSTIC LOGS (TEMPORARY) =====
    console.log(`[DIAG] allPartnerships count: ${allPartnerships.length}`)
    console.log(`[DIAG] allMembers count: ${allMembers?.length ?? 'null'}`)
    console.log(`[DIAG] nameMap size: ${nameMap.size}`)
    console.log(`[DIAG] nameMap entries:`, JSON.stringify(Object.fromEntries(nameMap)))
    for (const p of allPartnerships) {
      console.log(`[DIAG] partnership ${p.id.slice(0, 8)}: display_name=${JSON.stringify(p.display_name)}, nameMap.get=${JSON.stringify(nameMap.get(p.id))}`)
    }
    // ===== END DIAGNOSTIC LOGS =====

    console.log(`[recomputeAllMatches] Starting: ${allPartnerships.length} live partnerships`)
    for (const p of allPartnerships) {
      const name = p.display_name || nameMap.get(p.id) || null
      console.log(`[recomputeAllMatches]   queued: ${name} (${p.id})`)
    }

    let totalComputed = 0
    let totalErrors = 0

    for (let i = 0; i < allPartnerships.length; i++) {
      const partnership = allPartnerships[i]
      const resolvedName = partnership.display_name || nameMap.get(partnership.id) || null
      console.log(`[recomputeAllMatches] >>> LOOP ${i + 1}/${allPartnerships.length}: ${resolvedName} (${partnership.id})`)

      const result = await computeMatchesForPartnership(partnership.id)

      console.log(`[recomputeAllMatches] <<< LOOP ${i + 1} result: success=${result.success} matches=${result.matchesComputed} evaluated=${result.candidatesEvaluated} errors=${result.errors} error=${result.error || 'none'}`)

      totalComputed += result.matchesComputed
      totalErrors += result.errors

      // Resolve pair diagnostic candidate names using the nameMap
      const resolvedDiagnostics = result.pairDiagnostics?.map(pd => {
        // pd.candidate is either a display_name or a short ID (8 chars)
        // If it looks like a short ID, try to resolve it via nameMap
        if (pd.candidate && pd.candidate.length === 8 && !pd.candidate.includes(' ')) {
          // Find the full partnership ID that starts with this short ID
          const fullId = partnershipIds.find(id => id.startsWith(pd.candidate))
          if (fullId) {
            const resolved = nameMap.get(fullId)
            if (resolved) return { ...pd, candidate: resolved }
          }
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
        _debug: result._debug,
      })
    }

    // ===== DIAGNOSTIC LOG (TEMPORARY) =====
    console.log(`[DIAG-FINAL] details payload:`, JSON.stringify(details.map(d => ({ id: d.partnershipId.slice(0, 8), displayName: d.displayName, pairCount: d.pairDiagnostics?.length }))))
    // ===== END DIAGNOSTIC LOG =====

    console.log(`[recomputeAllMatches] DONE: ${totalComputed} matches across ${allPartnerships.length} partnerships, ${totalErrors} errors`)

    return { total: allPartnerships.length, computed: totalComputed, errors: totalErrors, details }
  } catch (error: any) {
    console.error('[recomputeAllMatches] Fatal error:', error)
    return { total: 0, computed: 0, errors: 0, details: [] }
  }
}
