'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateSurveyCompletion } from '@/lib/survey/questions'
import { getCurrentPartnershipId } from './partnership-simple'

/**
 * Extract profile fields from survey answers
 * Maps survey question answers to partnership table fields
 */
function extractProfileFieldsFromSurvey(answers: Record<string, any>): {
  short_bio: string | null
  intentions: string[]
  lifestyle_tags: string[]
  structure: { type: string; open_to?: string[] } | null
  orientation: { value: string; seeking?: string[] } | null
} {
  // Extract short_bio from q32_looking_for (max 140 chars)
  const short_bio = answers.q32_looking_for
    ? String(answers.q32_looking_for).slice(0, 140)
    : null

  // Extract intentions from q9_intentions
  const intentions: string[] = Array.isArray(answers.q9_intentions)
    ? answers.q9_intentions
    : []

  // Extract lifestyle_tags from multiple questions
  const lifestyle_tags: string[] = []

  // q18_substances
  if (Array.isArray(answers.q18_substances)) {
    lifestyle_tags.push(...answers.q18_substances)
  } else if (answers.q18_substances) {
    lifestyle_tags.push(answers.q18_substances)
  }

  // q23_erotic_styles
  if (Array.isArray(answers.q23_erotic_styles)) {
    lifestyle_tags.push(...answers.q23_erotic_styles)
  }

  // q24_experiences
  if (Array.isArray(answers.q24_experiences)) {
    lifestyle_tags.push(...answers.q24_experiences)
  }

  // q33_kinks
  if (Array.isArray(answers.q33_kinks)) {
    lifestyle_tags.push(...answers.q33_kinks)
  } else if (answers.q33_kinks) {
    lifestyle_tags.push(answers.q33_kinks)
  }

  // Extract structure from q4_relationship_status and q6a_connection_type
  let structure: { type: string; open_to?: string[] } | null = null
  if (answers.q4_relationship_status) {
    const status = answers.q4_relationship_status
    const connectionType = answers.q6a_connection_type
    const coupleConnection = answers.q6c_couple_connection

    // Determine profile type based on status
    let type = 'solo'
    if (status.toLowerCase().includes('couple') || status.toLowerCase().includes('married')) {
      type = 'couple'
    }

    structure = {
      type,
      open_to: Array.isArray(connectionType) ? connectionType : connectionType ? [connectionType] : []
    }
  }

  // Extract orientation from q3_sexual_orientation
  let orientation: { value: string; seeking?: string[] } | null = null
  if (answers.q3_sexual_orientation) {
    const value = Array.isArray(answers.q3_sexual_orientation)
      ? answers.q3_sexual_orientation.join(', ')
      : answers.q3_sexual_orientation

    orientation = {
      value,
      seeking: answers.q3c_partner_kinsey_preference
        ? (Array.isArray(answers.q3c_partner_kinsey_preference)
            ? answers.q3c_partner_kinsey_preference
            : [answers.q3c_partner_kinsey_preference])
        : []
    }
  }

  return {
    short_bio,
    intentions,
    lifestyle_tags,
    structure,
    orientation
  }
}

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

    // If 100% complete, update profile and partnership fields
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

        // Extract profile fields from survey answers and update partnership
        const profileFields = extractProfileFieldsFromSurvey(mergedAnswers)

        const { error: partnershipUpdateError } = await supabase
          .from('partnerships')
          .update({
            short_bio: profileFields.short_bio,
            intentions: profileFields.intentions,
            lifestyle_tags: profileFields.lifestyle_tags,
            structure: profileFields.structure,
            orientation: profileFields.orientation,
            profile_state: profileState
          })
          .eq('id', partnershipId)

        if (partnershipUpdateError) {
          console.error('[saveSurveyData] Partnership update error:', partnershipUpdateError)
          // Don't fail the whole save, survey data is saved
        } else {
          console.log('[saveSurveyData] Partnership profile fields updated from survey')
        }
      }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('[saveSurveyData] Error:', error)
    return { success: false, error: 'Failed to save survey data' }
  }
}