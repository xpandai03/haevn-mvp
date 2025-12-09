/**
 * Internal Compatibility Calculator
 *
 * Server-side function to calculate compatibility between partners
 * using the matching engine. This function fetches survey answers
 * from the database and runs them through the compatibility algorithm.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateCompatibility,
  normalizeAnswers,
  type RawAnswers,
  type CompatibilityResult,
} from '@/lib/matching'
import type { CompatibilityScores, CategoryScoreDisplay } from '@/lib/types/dashboard'

/**
 * Survey response data from the database
 */
interface SurveyResponse {
  user_id: string
  answers_json: RawAnswers | null
  completion_pct: number
}

/**
 * Partner survey data with couple status
 */
interface PartnerSurveyData {
  userId: string
  answers: RawAnswers
  isCouple: boolean
}

/**
 * Convert CompatibilityResult from matching engine to CompatibilityScores for UI
 */
function toCompatibilityScores(result: CompatibilityResult): CompatibilityScores {
  // Extract category scores into the expected format
  const categoryScores: CompatibilityScores['categories'] = {
    intent: 0,
    structure: 0,
    connection: 0,
    chemistry: 0,
    lifestyle: 0,
  }

  const categoryDetails: CategoryScoreDisplay[] = []

  for (const cat of result.categories) {
    categoryScores[cat.category] = Math.round(cat.score)
    categoryDetails.push({
      key: cat.category,
      score: Math.round(cat.score),
      weight: cat.weight,
      coverage: cat.coverage,
      included: cat.included,
    })
  }

  return {
    overall: result.overallScore,
    tier: result.tier,
    categories: categoryScores,
    categoryDetails,
    lifestyleIncluded: result.lifestyleIncluded,
  }
}

/**
 * Get internal compatibility scores for a partnership.
 *
 * For couples (2 members), calculates compatibility between the two partners.
 * For solo profiles, returns null (no internal compatibility).
 * For pods (3+ members), could extend to show pairwise scores (future).
 *
 * @param adminClient - Supabase admin client for database access
 * @param partnershipId - The partnership ID to calculate compatibility for
 * @param profileType - Type of partnership: 'solo', 'couple', or 'pod'
 * @returns CompatibilityScores or null if not applicable
 */
export async function getInternalCompatibility(
  adminClient: SupabaseClient,
  partnershipId: string,
  profileType: 'solo' | 'couple' | 'pod'
): Promise<CompatibilityScores | null> {
  // Solo profiles don't have internal compatibility
  if (profileType === 'solo') {
    return null
  }

  try {
    // 1. Fetch all partnership members
    const { data: members, error: membersError } = await adminClient
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)

    if (membersError || !members || members.length < 2) {
      console.warn('[getInternalCompatibility] Not enough members for compatibility calculation')
      return null
    }

    // 2. Fetch survey responses for all members
    const memberIds = members.map(m => m.user_id)
    const { data: surveys, error: surveyError } = await adminClient
      .from('user_survey_responses')
      .select('user_id, answers_json, completion_pct')
      .in('user_id', memberIds)

    if (surveyError || !surveys) {
      console.error('[getInternalCompatibility] Error fetching surveys:', surveyError)
      return null
    }

    // 3. Check if all members have completed surveys
    const surveysMap = new Map<string, SurveyResponse>()
    for (const survey of surveys) {
      surveysMap.set(survey.user_id, survey)
    }

    const completeSurveys: PartnerSurveyData[] = []
    for (const memberId of memberIds) {
      const survey = surveysMap.get(memberId)
      if (!survey || !survey.answers_json || survey.completion_pct < 100) {
        console.warn(`[getInternalCompatibility] Member ${memberId} has incomplete survey`)
        return null
      }
      completeSurveys.push({
        userId: memberId,
        answers: survey.answers_json as RawAnswers,
        isCouple: profileType === 'couple',
      })
    }

    // 4. For couples, calculate compatibility between the two partners
    if (profileType === 'couple' && completeSurveys.length === 2) {
      const [partnerA, partnerB] = completeSurveys

      const result = calculateCompatibility({
        partnerA: {
          partnershipId,
          userId: partnerA.userId,
          answers: normalizeAnswers(partnerA.answers),
          isCouple: true,
        },
        partnerB: {
          partnershipId,
          userId: partnerB.userId,
          answers: normalizeAnswers(partnerB.answers),
          isCouple: true,
        },
      })

      // If constraints blocked the match, still return scores but note the block
      if (!result.constraints.passed) {
        console.warn(
          `[getInternalCompatibility] Constraints blocked: ${result.constraints.reason}`
        )
        // Return the blocked result - UI can decide how to display
      }

      return toCompatibilityScores(result)
    }

    // 5. For pods, could calculate average pairwise compatibility (future)
    if (profileType === 'pod' && completeSurveys.length >= 2) {
      // For now, just calculate between first two members
      // TODO: Extend to show all pairwise scores or aggregate
      const [partnerA, partnerB] = completeSurveys

      const result = calculateCompatibility({
        partnerA: {
          partnershipId,
          userId: partnerA.userId,
          answers: normalizeAnswers(partnerA.answers),
          isCouple: false, // Pod members are individuals
        },
        partnerB: {
          partnershipId,
          userId: partnerB.userId,
          answers: normalizeAnswers(partnerB.answers),
          isCouple: false,
        },
      })

      return toCompatibilityScores(result)
    }

    return null
  } catch (error) {
    console.error('[getInternalCompatibility] Unexpected error:', error)
    return null
  }
}
