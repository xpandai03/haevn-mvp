'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateSurveyCompletion } from '@/lib/survey/questions'
import { getCurrentPartnershipId } from './partnership-simple'

export interface SurveyData {
  answers_json: Record<string, any>
  completion_pct: number
  current_step: number
}

/**
 * Server action to get survey data
 */
export async function getSurveyData(partnershipId: string | null): Promise<{ data: SurveyData | null, error: string | null }> {
  if (!partnershipId) {
    // If no partnership ID, try to get or create one
    const { id, error: partnershipError } = await getCurrentPartnershipId()
    if (partnershipError || !id) {
      return {
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0
        },
        error: null // Return empty data instead of error to allow user to start survey
      }
    }
    partnershipId = id
  }

  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('answers_json, completion_pct, current_step')
      .eq('partnership_id', partnershipId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('[getSurveyData] Error:', error)
      // Return empty data instead of throwing error
      return {
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0
        },
        error: null
      }
    }

    // Return empty survey if none exists
    if (!data) {
      // Try to create one
      await supabase
        .from('survey_responses')
        .insert({
          partnership_id: partnershipId,
          answers_json: {},
          completion_pct: 0,
          current_step: 0
        })
        .select()
        .single()

      return {
        data: {
          answers_json: {},
          completion_pct: 0,
          current_step: 0
        },
        error: null
      }
    }

    return {
      data: {
        answers_json: (data.answers_json as Record<string, any>) || {},
        completion_pct: data.completion_pct || 0,
        current_step: data.current_step || 0
      },
      error: null
    }
  } catch (err) {
    console.error('[getSurveyData] Unexpected error:', err)
    // Always return valid empty data
    return {
      data: {
        answers_json: {},
        completion_pct: 0,
        current_step: 0
      },
      error: null
    }
  }
}

/**
 * Server action to save survey data
 */
export async function saveSurveyData(
  partnershipId: string | null,
  partialAnswers: Record<string, any>,
  nextStep: number
): Promise<{ success: boolean, error: string | null }> {
  // Ensure we have a partnership ID
  if (!partnershipId) {
    const { id, error } = await getCurrentPartnershipId()
    if (error || !id) {
      console.error('[saveSurveyData] No partnership ID available')
      return { success: false, error: 'No partnership found' }
    }
    partnershipId = id
  }

  const supabase = await createClient()

  try {
    // Get existing answers
    const { data: existing } = await supabase
      .from('survey_responses')
      .select('answers_json')
      .eq('partnership_id', partnershipId)
      .maybeSingle()

    // Merge answers
    const mergedAnswers = {
      ...(existing?.answers_json as Record<string, any> || {}),
      ...partialAnswers
    }

    // Calculate completion
    const completionPct = calculateSurveyCompletion(mergedAnswers)

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

    if (updateError) {
      console.error('[saveSurveyData] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

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

        // Update partnership profile state when that field exists
        // await supabase
        //   .from('partnerships')
        //   .update({ profile_state: profileState })
        //   .eq('id', partnershipId)
      }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('[saveSurveyData] Error:', error)
    return { success: false, error: 'Failed to save survey data' }
  }
}