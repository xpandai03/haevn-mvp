/**
 * Match Computation Service
 * 
 * Automatically calculates and stores compatibility matches in computed_matches table.
 * Called when a user completes onboarding (survey reaches 100%).
 */

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculateCompatibility,
  normalizeAnswers,
  type RawAnswers,
  type CompatibilityTier,
} from '@/lib/matching'

// =============================================================================
// TYPES
// =============================================================================

export interface ComputeMatchesResult {
  success: boolean
  matchesComputed: number
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
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get survey answers for a partnership
 * Returns null if no completed survey found
 */
async function getPartnershipAnswers(
  adminClient: ReturnType<typeof createAdminClient>,
  partnershipId: string
): Promise<RawAnswers | null> {
  // Get all members of the partnership
  const { data: members } = await adminClient
    .from('partnership_members')
    .select('user_id')
    .eq('partnership_id', partnershipId)

  if (!members || members.length === 0) {
    return null
  }

  // Get survey responses for all members
  const memberIds = members.map(m => m.user_id)
  const { data: surveys } = await adminClient
    .from('user_survey_responses')
    .select('user_id, answers_json, completion_pct')
    .in('user_id', memberIds)

  if (!surveys || surveys.length === 0) {
    return null
  }

  // Find a completed survey (at least one member must have completed)
  const completedSurvey = surveys.find(s => s.completion_pct >= 100 && s.answers_json)

  if (!completedSurvey || !completedSurvey.answers_json) {
    return null
  }

  // Use the first completed survey's answers
  return completedSurvey.answers_json as RawAnswers
}

/**
 * Store a computed match in the database (bidirectional)
 */
async function storeComputedMatch(
  adminClient: ReturnType<typeof createAdminClient>,
  partnershipA: string,
  partnershipB: string,
  score: number,
  tier: CompatibilityTier,
  breakdown: any
): Promise<void> {
  const matchData = {
    partnership_a: partnershipA,
    partnership_b: partnershipB,
    score,
    tier,
    breakdown,
    computed_at: new Date().toISOString(),
  }

  // Upsert A -> B
  // Note: Supabase upsert uses the unique constraint automatically
  const { error: errorAB } = await adminClient
    .from('computed_matches')
    .upsert(matchData)

  if (errorAB) {
    console.error(`[storeComputedMatch] Error storing A->B:`, errorAB)
    throw new Error(`Failed to store match A->B: ${errorAB.message}`)
  }

  // Upsert B -> A (reverse direction, same score)
  const reverseMatchData = {
    partnership_a: partnershipB,
    partnership_b: partnershipA,
    score,
    tier,
    breakdown,
    computed_at: new Date().toISOString(),
  }

  const { error: errorBA } = await adminClient
    .from('computed_matches')
    .upsert(reverseMatchData)

  if (errorBA) {
    console.error(`[storeComputedMatch] Error storing B->A:`, errorBA)
    throw new Error(`Failed to store match B->A: ${errorBA.message}`)
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Compute matches for a single partnership against all other partnerships.
 * 
 * This is called automatically when a user completes onboarding.
 * 
 * @param partnershipId - The partnership to compute matches for
 * @returns Result with count of matches computed
 */
export async function computeMatchesForPartnership(
  partnershipId: string
): Promise<ComputeMatchesResult> {
  const adminClient = await createAdminClient()
  let matchesComputed = 0
  let errors = 0

  try {
    console.log(`[computeMatches] Starting match calculation for partnership: ${partnershipId}`)

    // 1. Get current partnership details
    const { data: currentPartnership, error: currentError } = await adminClient
      .from('partnerships')
      .select('id, profile_type, city, msa, display_name')
      .eq('id', partnershipId)
      .single()

    if (currentError || !currentPartnership) {
      return {
        success: false,
        matchesComputed: 0,
        errors: 0,
        error: `Partnership not found: ${currentError?.message || 'Unknown error'}`,
      }
    }

    // 2. Get current partnership's survey answers
    const currentAnswers = await getPartnershipAnswers(adminClient, partnershipId)
    if (!currentAnswers) {
      console.warn(`[computeMatches] Partnership ${partnershipId} has no completed survey`)
      return {
        success: false,
        matchesComputed: 0,
        errors: 0,
        error: 'Partnership has no completed survey',
      }
    }

    const currentIsCouple = currentPartnership.profile_type === 'couple'
    const normalizedCurrentAnswers = normalizeAnswers(currentAnswers)

    // 3. Get all other partnerships with completed surveys
    const { data: allPartnerships, error: partnershipsError } = await adminClient
      .from('partnerships')
      .select('id, profile_type, city, msa, display_name')
      .neq('id', partnershipId)
      .not('display_name', 'is', null)

    if (partnershipsError) {
      return {
        success: false,
        matchesComputed: 0,
        errors: 0,
        error: `Failed to fetch partnerships: ${partnershipsError.message}`,
      }
    }

    if (!allPartnerships || allPartnerships.length === 0) {
      console.log(`[computeMatches] No other partnerships found`)
      return {
        success: true,
        matchesComputed: 0,
        errors: 0,
      }
    }

    console.log(`[computeMatches] Found ${allPartnerships.length} potential matches to evaluate`)

    // 4. Calculate compatibility for each potential match
    for (const matchPartnership of allPartnerships) {
      try {
        // Get match's survey answers
        const matchAnswers = await getPartnershipAnswers(adminClient, matchPartnership.id)
        if (!matchAnswers) {
          continue // Skip partnerships without completed surveys
        }

        const matchIsCouple = matchPartnership.profile_type === 'couple'
        const normalizedMatchAnswers = normalizeAnswers(matchAnswers)

        // Calculate compatibility using the 5-category engine
        const result = calculateCompatibility({
          partnerA: {
            partnershipId,
            userId: '',
            answers: normalizedCurrentAnswers,
            isCouple: currentIsCouple,
          },
          partnerB: {
            partnershipId: matchPartnership.id,
            userId: '',
            answers: normalizedMatchAnswers,
            isCouple: matchIsCouple,
          },
        })

        // Skip if constraints failed (blocked match)
        if (!result.constraints.passed) {
          continue
        }

        // Only store Bronze tier and above
        const tierOrder: CompatibilityTier[] = ['Platinum', 'Gold', 'Silver', 'Bronze']
        const tierIndex = tierOrder.indexOf(result.tier)
        if (tierIndex === -1 || tierIndex > tierOrder.indexOf('Bronze')) {
          continue // Below Bronze tier, skip
        }

        // Store the match (bidirectional)
        await storeComputedMatch(
          adminClient,
          partnershipId,
          matchPartnership.id,
          result.overallScore,
          result.tier,
          result.categories // Store full category breakdown
        )

        matchesComputed++
      } catch (matchError: any) {
        errors++
        console.error(
          `[computeMatches] Error calculating match for partnership ${matchPartnership.id}:`,
          matchError
        )
        // Continue with next match
      }
    }

    console.log(
      `[computeMatches] Completed: ${matchesComputed} matches computed, ${errors} errors for partnership ${partnershipId}`
    )

    return {
      success: true,
      matchesComputed,
      errors,
    }
  } catch (error: any) {
    console.error(`[computeMatches] Fatal error for partnership ${partnershipId}:`, error)
    return {
      success: false,
      matchesComputed,
      errors,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Recompute matches for all partnerships.
 * 
 * Admin function to backfill or refresh all matches.
 * 
 * @returns Summary of recomputation results
 */
export async function recomputeAllMatches(): Promise<RecomputeAllResult> {
  const adminClient = await createAdminClient()
  const details: RecomputeAllResult['details'] = []

  try {
    // Get all partnerships with completed surveys
    const { data: allPartnerships, error } = await adminClient
      .from('partnerships')
      .select('id, display_name')
      .not('display_name', 'is', null)

    if (error || !allPartnerships) {
      return {
        total: 0,
        computed: 0,
        errors: 0,
        details: [],
      }
    }

    console.log(`[recomputeAllMatches] Found ${allPartnerships.length} partnerships to process`)

    let totalComputed = 0
    let totalErrors = 0

    // Process each partnership
    for (const partnership of allPartnerships) {
      // Check if partnership has completed survey
      const hasSurvey = await getPartnershipAnswers(adminClient, partnership.id)
      if (!hasSurvey) {
        details.push({
          partnershipId: partnership.id,
          success: false,
          matchesComputed: 0,
          error: 'No completed survey',
        })
        continue
      }

      // Compute matches for this partnership
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
      `[recomputeAllMatches] Completed: ${totalComputed} total matches computed across ${allPartnerships.length} partnerships`
    )

    return {
      total: allPartnerships.length,
      computed: totalComputed,
      errors: totalErrors,
      details,
    }
  } catch (error: any) {
    console.error('[recomputeAllMatches] Fatal error:', error)
    return {
      total: 0,
      computed: 0,
      errors: 0,
      details: [],
    }
  }
}
