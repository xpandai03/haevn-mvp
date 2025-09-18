import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/supabase'

type SurveyResponse = Database['public']['Tables']['survey_responses']['Row']

export interface SurveyData {
  answers_json: Record<string, any>
  completion_pct: number
  current_step: number
}

/**
 * Get survey responses for a partnership
 */
export async function getSurvey(partnershipId: string): Promise<SurveyData> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('survey_responses')
    .select('answers_json, completion_pct, current_step')
    .eq('partnership_id', partnershipId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[getSurvey] Error:', error)
    throw new Error('Failed to load survey data')
  }

  // Return empty survey if none exists
  if (!data) {
    return {
      answers_json: {},
      completion_pct: 0,
      current_step: 0
    }
  }

  return {
    answers_json: (data.answers_json as Record<string, any>) || {},
    completion_pct: data.completion_pct || 0,
    current_step: data.current_step || 0
  }
}

/**
 * Save survey responses with partial updates
 */
export async function saveSurvey(
  partnershipId: string,
  partialAnswers: Record<string, any>,
  nextStep: number
): Promise<void> {
  const supabase = createClient()

  try {
    // Get existing answers
    const { data: existing } = await supabase
      .from('survey_responses')
      .select('answers_json')
      .eq('partnership_id', partnershipId)
      .single()

    // Merge answers
    const mergedAnswers = {
      ...(existing?.answers_json as Record<string, any> || {}),
      ...partialAnswers
    }

    // Calculate completion
    const completionPct = calculateCompletion(mergedAnswers)

    // Update survey response
    const { error: updateError } = await supabase
      .from('survey_responses')
      .upsert({
        partnership_id: partnershipId,
        answers_json: mergedAnswers,
        completion_pct: completionPct,
        current_step: nextStep
      }, {
        onConflict: 'partnership_id'
      })

    if (updateError) throw updateError

    // If 100% complete, update profile
    if (completionPct === 100) {
      // Get partnership owner
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('owner_id')
        .eq('id', partnershipId)
        .single()

      if (partnership) {
        // Update profile survey_complete flag
        await supabase
          .from('profiles')
          .update({ survey_complete: true })
          .eq('user_id', partnership.owner_id)

        // Check if partnership has photos to determine profile state
        const { data: photos } = await supabase
          .from('partnership_photos')
          .select('id')
          .eq('partnership_id', partnershipId)
          .eq('photo_type', 'public')
          .limit(1)

        const profileState = photos && photos.length > 0 ? 'live' : 'draft'

        // Update partnership profile state
        await supabase
          .from('partnerships')
          .update({ profile_state: profileState })
          .eq('id', partnershipId)
      }
    }
  } catch (error) {
    console.error('[saveSurvey] Error:', error)
    throw new Error('Failed to save survey data')
  }
}

/**
 * Calculate survey completion percentage based on required questions
 */
export function calculateCompletion(answers: Record<string, any>): number {
  // Define required questions based on skip logic
  const requiredQuestions = getRequiredQuestions(answers)

  // Count answered required questions
  const answeredCount = requiredQuestions.filter(questionId => {
    const answer = answers[questionId]
    if (Array.isArray(answer)) {
      return answer.length > 0
    }
    return answer !== undefined && answer !== null && answer !== ''
  }).length

  if (requiredQuestions.length === 0) return 0

  return Math.round((answeredCount / requiredQuestions.length) * 100)
}

/**
 * Get list of required questions based on skip logic
 */
function getRequiredQuestions(answers: Record<string, any>): string[] {
  const required = [
    // Identity - always required
    'identity_pronouns',
    'identity_age_range',
    'identity_gender',
    'identity_orientation',
    'identity_relationship_structure',

    // Intentions - always required
    'intentions_looking_for',
    'intentions_timeline',
    'intentions_marriage_minded',

    // Boundaries - always required
    'boundaries_relationship_orientation',
    'boundaries_privacy_level',
    'boundaries_photo_sharing',
    'boundaries_dealbreakers',

    // Logistics - always required
    'logistics_city',
    'logistics_location_radius',
    'logistics_availability'
  ]

  // Conditional questions based on answers

  // If marriage-minded, ask about children
  if (answers['intentions_marriage_minded'] === 'Yes') {
    required.push('intentions_children_interest')
  }

  // If not monogamous, add multi-partner questions (Phase 2)
  // const relationshipOrientation = answers['boundaries_relationship_orientation']
  // if (relationshipOrientation && relationshipOrientation !== 'Monogamous') {
  //   required.push('boundaries_multi_partner_preferences')
  // }

  // If not very private, add lifestyle tags
  if (answers['boundaries_privacy_level'] !== 'Very Private') {
    required.push('logistics_lifestyle_tags')
  }

  return required
}