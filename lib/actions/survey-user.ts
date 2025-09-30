'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateSurveyCompletion } from '@/lib/survey/questions'

export interface UserSurveyData {
  answers_json: Record<string, any>
  completion_pct: number
  current_step: number
}

/**
 * Get survey data for the current user
 */
export async function getUserSurveyData(): Promise<{ data: UserSurveyData | null, error: string | null }> {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[getUserSurveyData] No authenticated user')
    return {
      data: null,
      error: 'Not authenticated'
    }
  }

  try {
    // Try to get existing survey data
    const { data, error } = await supabase
      .from('user_survey_responses')
      .select('answers_json, completion_pct, current_step')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('[getUserSurveyData] Error:', error)
      return {
        data: null,
        error: error.message
      }
    }

    // Return survey data or empty survey
    if (!data) {
      // Create initial empty survey response
      const { data: newData, error: insertError } = await supabase
        .from('user_survey_responses')
        .insert({
          user_id: user.id,
          answers_json: {},
          completion_pct: 0,
          current_step: 0
        })
        .select()
        .single()

      if (insertError) {
        console.error('[getUserSurveyData] Insert error:', insertError)
        // Return empty data even if insert fails
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
    console.error('[getUserSurveyData] Unexpected error:', err)
    return {
      data: null,
      error: 'Failed to load survey data'
    }
  }
}

/**
 * Save survey data for the current user
 */
export async function saveUserSurveyData(
  partialAnswers: Record<string, any>,
  currentQuestionIndex: number
): Promise<{ success: boolean, error: string | null }> {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[saveUserSurveyData] No authenticated user')
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get existing answers
    const { data: existing } = await supabase
      .from('user_survey_responses')
      .select('answers_json')
      .eq('user_id', user.id)
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
      .from('user_survey_responses')
      .upsert({
        user_id: user.id,
        answers_json: mergedAnswers,
        completion_pct: completionPct,
        current_step: currentQuestionIndex
      }, {
        onConflict: 'user_id'
      })

    if (updateError) {
      console.error('[saveUserSurveyData] Update error:', updateError)
      return { success: false, error: updateError.message }
    }

    // Always ensure onboarding state exists and is updated
    await supabase
      .from('user_onboarding_state')
      .upsert({
        user_id: user.id,
        survey_completed: completionPct === 100,
        current_step: completionPct === 100 ? 'membership' : 'survey',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    // If 100% complete, update profile
    if (completionPct === 100) {
      await supabase
        .from('profiles')
        .update({ survey_complete: true })
        .eq('user_id', user.id)
    }

    console.log('[saveUserSurveyData] Saved successfully:', {
      userId: user.id,
      completionPct,
      currentStep: currentQuestionIndex
    })

    return { success: true, error: null }
  } catch (error) {
    console.error('[saveUserSurveyData] Error:', error)
    return { success: false, error: 'Failed to save survey data' }
  }
}