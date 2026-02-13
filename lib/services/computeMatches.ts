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

const ENGINE_VERSION = '5cat-v3'

// =============================================================================
// TYPES
// =============================================================================

export interface PairDiagnostic {
  candidate: string
  score: number
  tier: string
  outcome: 'stored' | 'constraint-failed' | 'no-survey' | 'no-members' | 'handshake' | 'scoring-error'
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
}

export interface RecomputeAllResult {
  total: number
  computed: number
  errors: number
  details: Array<{
    partnershipId: string
    displayName: string | null
    success: boolean
    matchesComputed: number
    candidatesEvaluated: number
    error?: string
    pairDiagnostics?: PairDiagnostic[]
    upsertError?: string
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
  console.log(`[computeMatches] BUILD_MARKER=2026-02-13T1 ENTERED id=${partnershipId} engine=${ENGINE_VERSION}`)

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
      .select('id, profile_type, city, msa, display_name')
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
    const currentRawAnswers = currentCompletedSurvey.answers_json as RawAnswers
    const currentIsCouple = currentPartnership.profile_type === 'couple'

    console.log(`[computeMatches] Current: ${currentPartnership.display_name} | rawKeys=${Object.keys(currentRawAnswers).length} | isCouple=${currentIsCouple}`)

    // =========================================================================
    // 3. Fetch ALL candidate partnerships (live, with display_name)
    // =========================================================================
    const { data: allPartnerships, error: partnershipsError } = await adminClient
      .from('partnerships')
      .select('id, profile_type, city, msa, display_name')
      .neq('id', partnershipId)
      .eq('profile_state', 'live')
      .not('display_name', 'is', null)

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
    }> = []

    for (const candidate of allPartnerships) {
      candidatesEvaluated++

      const name = candidate.display_name || candidate.id.slice(0, 8)

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

        const result = calculateCompatibilityFromRaw(
          currentRawAnswers,
          candidateRawAnswers,
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

        // Store match (both directions)
        const now = new Date().toISOString()
        matchRows.push({
          partnership_a: partnershipId,
          partnership_b: candidate.id,
          score: result.overallScore,
          tier: result.tier,
          breakdown: result.categories,
          computed_at: now,
          engine_version: ENGINE_VERSION,
        })
        matchRows.push({
          partnership_a: candidate.id,
          partnership_b: partnershipId,
          score: result.overallScore,
          tier: result.tier,
          breakdown: result.categories,
          computed_at: now,
          engine_version: ENGINE_VERSION,
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
  console.log(`[recomputeAllMatches] BUILD_MARKER=2026-02-13T1 engine=${ENGINE_VERSION}`)
  const adminClient = createAdminClient()
  const details: RecomputeAllResult['details'] = []

  try {
    const { data: allPartnerships, error } = await adminClient
      .from('partnerships')
      .select('id, display_name')
      .eq('profile_state', 'live')
      .not('display_name', 'is', null)

    if (error || !allPartnerships) {
      console.error('[recomputeAllMatches] Failed to fetch partnerships:', error)
      return { total: 0, computed: 0, errors: 0, details: [] }
    }

    console.log(`[recomputeAllMatches] Starting: ${allPartnerships.length} live partnerships`)
    for (const p of allPartnerships) {
      console.log(`[recomputeAllMatches]   queued: ${p.display_name} (${p.id})`)
    }

    let totalComputed = 0
    let totalErrors = 0

    for (let i = 0; i < allPartnerships.length; i++) {
      const partnership = allPartnerships[i]
      console.log(`[recomputeAllMatches] >>> LOOP ${i + 1}/${allPartnerships.length}: ${partnership.display_name} (${partnership.id})`)

      const result = await computeMatchesForPartnership(partnership.id)

      console.log(`[recomputeAllMatches] <<< LOOP ${i + 1} result: success=${result.success} matches=${result.matchesComputed} evaluated=${result.candidatesEvaluated} errors=${result.errors} error=${result.error || 'none'}`)

      totalComputed += result.matchesComputed
      totalErrors += result.errors

      details.push({
        partnershipId: partnership.id,
        displayName: partnership.display_name,
        success: result.success,
        matchesComputed: result.matchesComputed,
        candidatesEvaluated: result.candidatesEvaluated,
        error: result.error,
        pairDiagnostics: result.pairDiagnostics,
        upsertError: result.upsertError,
      })
    }

    console.log(`[recomputeAllMatches] DONE: ${totalComputed} matches across ${allPartnerships.length} partnerships, ${totalErrors} errors`)

    return { total: allPartnerships.length, computed: totalComputed, errors: totalErrors, details }
  } catch (error: any) {
    console.error('[recomputeAllMatches] Fatal error:', error)
    return { total: 0, computed: 0, errors: 0, details: [] }
  }
}
