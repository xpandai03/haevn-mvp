import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/supabase'

type Partnership = Database['public']['Tables']['partnerships']['Row']
type SurveyResponse = Database['public']['Tables']['survey_responses']['Row']

export async function ensureUserPartnership(userId: string) {
  const supabase = createClient()

  try {
    console.log('[Partnership] Checking for existing partnership for user:', userId)

    // Check if user already has a partnership
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('partnership_members')
      .select('partnership_id, partnerships(*)')
      .eq('user_id', userId)
      .single()

    if (memberCheckError && memberCheckError.code !== 'PGRST116') {
      console.error('[Partnership] Error checking existing membership:', memberCheckError)
      throw memberCheckError
    }

    if (existingMember?.partnership_id) {
      console.log('[Partnership] Found existing partnership:', existingMember.partnership_id)
      return {
        partnership: existingMember.partnerships,
        isNew: false,
        error: null
      }
    }

    console.log('[Partnership] No existing partnership, creating new one...')

    // Get user profile for city info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('city')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error('[Partnership] Error fetching user profile:', profileError)
      // Continue anyway with default city
    }

    console.log('[Partnership] User profile city:', profile?.city || 'New York (default)')

    // Create new partnership
    const { data: partnership, error: createError } = await supabase
      .from('partnerships')
      .insert({
        owner_id: userId,
        city: profile?.city || 'New York',
        membership_tier: 'free'
      })
      .select()
      .single()

    if (createError) {
      console.error('[Partnership] Error creating partnership:', createError)
      throw createError
    }

    console.log('[Partnership] Created partnership:', partnership.id)

    // Add user as member
    const { error: memberError } = await supabase
      .from('partnership_members')
      .insert({
        partnership_id: partnership.id,
        user_id: userId,
        role: 'owner'
      })

    if (memberError) {
      console.error('[Partnership] Error adding user as member:', memberError)
      throw memberError
    }

    console.log('[Partnership] Added user as owner member')

    // Create empty survey response
    const { error: surveyError } = await supabase
      .from('survey_responses')
      .insert({
        partnership_id: partnership.id,
        answers_json: {},
        completion_pct: 0
      })

    if (surveyError) {
      console.error('[Partnership] Error creating survey response:', surveyError)
      throw surveyError
    }

    console.log('[Partnership] Created empty survey response')

    return {
      partnership,
      isNew: true,
      error: null
    }
  } catch (error) {
    console.error('[Partnership] Fatal error ensuring partnership:', error)
    return {
      partnership: null,
      isNew: false,
      error
    }
  }
}

export async function saveSurveyResponses(
  partnershipId: string,
  responses: Record<string, any>,
  completionPct: number
) {
  const supabase = createClient()

  try {
    // Upsert survey responses
    const { data, error } = await supabase
      .from('survey_responses')
      .upsert({
        partnership_id: partnershipId,
        answers_json: responses,
        completion_pct: completionPct
      }, {
        onConflict: 'partnership_id'
      })
      .select()
      .single()

    if (error) throw error

    // Update profile survey_complete flag if 100%
    if (completionPct === 100) {
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('owner_id')
        .eq('id', partnershipId)
        .single()

      if (partnership) {
        await supabase
          .from('profiles')
          .update({ survey_complete: true })
          .eq('user_id', partnership.owner_id)
      }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Error saving survey responses:', error)
    return { data: null, error }
  }
}

export async function getSurveyResponses(partnershipId: string) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('partnership_id', partnershipId)
      .single()

    if (error && error.code !== 'PGRST116') throw error // Ignore not found error

    return {
      data: data || {
        partnership_id: partnershipId,
        answers_json: {},
        completion_pct: 0
      },
      error: null
    }
  } catch (error) {
    console.error('Error fetching survey responses:', error)
    return { data: null, error }
  }
}