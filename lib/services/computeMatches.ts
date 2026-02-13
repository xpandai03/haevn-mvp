/**
 * Match Computation Service
 *
 * Automatically calculates and stores compatibility matches in computed_matches table.
 * Called when a user completes onboarding (survey reaches 100%).
 *
 * Architecture:
 *   - All candidate data fetched in ~6 bulk queries (no N+1)
 *   - Scoring runs in-memory (pure computation)
 *   - Results batch-upserted in a single write
 *   - Tracks run status in match_compute_runs table
 */

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculateCompatibility,
  normalizeAnswers,
  validateNormalizedAnswers,
  type RawAnswers,
  type CompatibilityTier,
} from '@/lib/matching'

const ENGINE_VERSION = '5cat-v2'

// =============================================================================
// TYPES
// =============================================================================

export interface ComputeMatchesResult {
  success: boolean
  matchesComputed: number
  candidatesEvaluated: number
  errors: number
  error?: string
}

export interface RecomputeAllResult {
  total: number
  computed: number
  errors: number
  details: Array<{
    partnershipId: string
    success: boolean
    matchesComputed: number
    error?: string
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
    // Don't let run tracking failures break computation
    console.warn('[computeMatches] Failed to update run status:', err)
  }
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Compute matches for a single partnership against all other partnerships.
 *
 * Uses batched DB queries to avoid N+1 pattern:
 *   1. Fetch current partnership
 *   2. Fetch current partnership's survey (members → surveys)
 *   3. Fetch ALL candidate partnerships (profile_state='live')
 *   4. Fetch ALL candidate members in one query
 *   5. Fetch ALL candidate surveys in one query
 *   6. Fetch handshakes for exclusion
 *   7. Score in memory
 *   8. Batch upsert results
 *
 * @param partnershipId - The partnership to compute matches for
 * @param runId - Optional match_compute_runs row ID for status tracking
 */
export async function computeMatchesForPartnership(
  partnershipId: string,
  runId: string | null = null
): Promise<ComputeMatchesResult> {
  const adminClient = createAdminClient()
  let matchesComputed = 0
  let candidatesEvaluated = 0
  let errors = 0

  // Mark run as running
  await updateRunStatus(adminClient, runId, {
    status: 'running',
    started_at: new Date().toISOString(),
  })

  try {
    console.log(`[computeMatches] Starting match calculation for partnership: ${partnershipId} (engine=${ENGINE_VERSION})`)

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
      const errMsg = 'Partnership has no members'
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

    const currentCompletedSurvey = currentSurveys?.find(
      s => s.completion_pct >= 100 && s.answers_json
    )

    if (!currentCompletedSurvey?.answers_json) {
      const errMsg = 'Partnership has no completed survey'
      console.warn(`[computeMatches] ${errMsg} for ${partnershipId}`)
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    const currentAnswers = currentCompletedSurvey.answers_json as RawAnswers
    const currentIsCouple = currentPartnership.profile_type === 'couple'

    // Log raw answer keys for traceability
    const rawKeys = Object.keys(currentAnswers)
    console.log(`[computeMatches] RAW keys (${rawKeys.length}): ${rawKeys.slice(0, 10).join(', ')}`)

    const normalizedCurrentAnswers = normalizeAnswers(currentAnswers)

    // Validate normalization worked — this is the critical checkpoint
    const currentValidation = validateNormalizedAnswers(normalizedCurrentAnswers, partnershipId)
    console.log(`[computeMatches] VALIDATION current:`, JSON.stringify(currentValidation))
    if (currentValidation.missingCritical.length > 0) {
      console.warn(`[computeMatches] ⚠️ Current partnership missing critical keys: ${currentValidation.missingCritical.join(', ')}`)
    }

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
    console.log(`[computeMatches] Found ${allPartnerships.length} live candidates to evaluate`)

    // =========================================================================
    // 4. Fetch ALL candidate members in one query
    // =========================================================================
    const { data: allMembers } = await adminClient
      .from('partnership_members')
      .select('partnership_id, user_id')
      .in('partnership_id', candidateIds)

    // Build map: partnership_id → user_id[]
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

    // Build map: user_id → survey
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
    // 7. Score each candidate in memory (no DB calls in this loop)
    // =========================================================================
    let constraintsFailed = 0
    let noSurvey = 0
    let belowBronze = 0
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

      // Skip if handshake exists (pending, matched, or dismissed)
      if (excludedIds.has(candidate.id)) {
        console.log(`[computeMatches] Skipped ${candidate.id} (${candidate.display_name}): existing handshake`)
        continue
      }

      // Get candidate's completed survey from in-memory maps
      const memberIds = membersByPartnership.get(candidate.id)
      if (!memberIds || memberIds.length === 0) {
        noSurvey++
        continue
      }

      let completedAnswers: RawAnswers | null = null
      for (const uid of memberIds) {
        const survey = surveyByUser.get(uid)
        if (survey && survey.completion_pct >= 100 && survey.answers_json) {
          completedAnswers = survey.answers_json as RawAnswers
          break
        }
      }

      if (!completedAnswers) {
        noSurvey++
        console.log(`[computeMatches] Skipped ${candidate.id} (${candidate.display_name}): no completed survey`)
        continue
      }

      try {
        const matchIsCouple = candidate.profile_type === 'couple'
        const normalizedMatchAnswers = normalizeAnswers(completedAnswers)

        // Validate first candidate's normalization for diagnostics
        if (candidatesEvaluated <= 1) {
          const matchValidation = validateNormalizedAnswers(normalizedMatchAnswers, candidate.display_name || candidate.id)
          console.log(`[computeMatches] VALIDATION candidate:`, JSON.stringify(matchValidation))
        }

        // Calculate compatibility using the 5-category engine
        const result = calculateCompatibility({
          partnerA: {
            partnershipId,
            userId: '',
            answers: normalizedCurrentAnswers,
            isCouple: currentIsCouple,
          },
          partnerB: {
            partnershipId: candidate.id,
            userId: '',
            answers: normalizedMatchAnswers,
            isCouple: matchIsCouple,
          },
        })

        // Log full result for first candidate (always) — critical for debugging
        if (candidatesEvaluated <= 1) {
          console.log(`[computeMatches] FULL RESULT ${candidate.display_name}:`, JSON.stringify({
            overallScore: result.overallScore,
            tier: result.tier,
            constraints: result.constraints,
            categories: result.categories.map(c => ({
              cat: c.category,
              score: c.score,
              included: c.included,
              matchedSubs: c.subScores.filter(s => s.matched).length,
              totalSubs: c.subScores.length,
            })),
          }))
        }

        // Skip if constraints failed
        if (!result.constraints.passed) {
          constraintsFailed++
          console.log(`[computeMatches] Skipped ${candidate.id} (${candidate.display_name}): constraint failed — ${result.constraints.reason || 'unknown'}`)
          continue
        }

        // Only store Bronze tier and above
        const tierOrder: CompatibilityTier[] = ['Platinum', 'Gold', 'Silver', 'Bronze']
        const tierIndex = tierOrder.indexOf(result.tier)
        if (tierIndex === -1 || tierIndex > tierOrder.indexOf('Bronze')) {
          belowBronze++
          console.log(`[computeMatches] Skipped ${candidate.id} (${candidate.display_name}): below Bronze — score=${result.overallScore}, tier=${result.tier}`)
          continue
        }

        console.log(`[computeMatches] ✅ Match: ${candidate.display_name} — score=${result.overallScore}, tier=${result.tier}, categories=${JSON.stringify(result.categories.map(c => ({ cat: c.category, score: c.score })))}`)

        const now = new Date().toISOString()

        // Collect both directions for batch upsert
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
      } catch (matchError: any) {
        errors++
        console.error(
          `[computeMatches] Error scoring ${candidate.id}:`,
          matchError?.message || matchError
        )
      }
    }

    // =========================================================================
    // 8. Batch upsert all match rows in one write
    // =========================================================================
    if (matchRows.length > 0) {
      const { error: upsertError } = await adminClient
        .from('computed_matches')
        .upsert(matchRows, { onConflict: 'partnership_a,partnership_b' })

      if (upsertError) {
        console.error(`[computeMatches] Batch upsert failed:`, upsertError)
        errors += matchRows.length / 2 // Each match = 2 rows
        matchesComputed = 0
      }
    }

    console.log(
      `[computeMatches] Summary for ${partnershipId}: ` +
      `${candidatesEvaluated} evaluated, ${noSurvey} no survey, ` +
      `${constraintsFailed} constraints failed, ${belowBronze} below Bronze, ` +
      `${matchesComputed} stored, ${errors} errors`
    )

    // Update run status
    await updateRunStatus(adminClient, runId, {
      status: errors > 0 && matchesComputed === 0 ? 'error' : 'success',
      finished_at: new Date().toISOString(),
      candidates_evaluated: candidatesEvaluated,
      matches_written: matchesComputed,
      error_message: errors > 0 ? `${errors} scoring errors` : null,
    })

    return { success: true, matchesComputed, candidatesEvaluated, errors }
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
 * Recompute matches for all partnerships.
 *
 * Admin function to backfill or refresh all matches.
 */
export async function recomputeAllMatches(): Promise<RecomputeAllResult> {
  const adminClient = createAdminClient()
  const details: RecomputeAllResult['details'] = []

  try {
    // Get all live partnerships with display names
    const { data: allPartnerships, error } = await adminClient
      .from('partnerships')
      .select('id, display_name')
      .eq('profile_state', 'live')
      .not('display_name', 'is', null)

    if (error || !allPartnerships) {
      return { total: 0, computed: 0, errors: 0, details: [] }
    }

    console.log(`[recomputeAllMatches] Found ${allPartnerships.length} live partnerships to process`)

    let totalComputed = 0
    let totalErrors = 0

    for (const partnership of allPartnerships) {
      const result = await computeMatchesForPartnership(partnership.id)
      totalComputed += result.matchesComputed
      totalErrors += result.errors

      details.push({
        partnershipId: partnership.id,
        success: result.success,
        matchesComputed: result.matchesComputed,
        error: result.error,
      })
    }

    console.log(
      `[recomputeAllMatches] Completed: ${totalComputed} total matches across ${allPartnerships.length} partnerships`
    )

    return { total: allPartnerships.length, computed: totalComputed, errors: totalErrors, details }
  } catch (error: any) {
    console.error('[recomputeAllMatches] Fatal error:', error)
    return { total: 0, computed: 0, errors: 0, details: [] }
  }
}
