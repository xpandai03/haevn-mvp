'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/supabase'

type Partnership = Database['public']['Tables']['partnerships']['Row']

/**
 * Server action to get or create partnership for current user
 */
export async function getCurrentPartnershipId(): Promise<{ id: string | null, error: string | null }> {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[getCurrentPartnershipId] No authenticated user')
      return { id: null, error: 'Not authenticated' }
    }

    // Check if user already belongs to a partnership
    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError && membershipError.code !== 'PGRST116') {
      console.error('[getCurrentPartnershipId] Error checking membership:', membershipError)
    }

    if (membership?.partnership_id) {
      console.log('[getCurrentPartnershipId] Found existing partnership:', membership.partnership_id)
      return { id: membership.partnership_id, error: null }
    }

    // Get user profile for city info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('city, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('[getCurrentPartnershipId] Profile data:', profile)

    if (!profile) {
      // Create profile if it doesn't exist
      console.log('[getCurrentPartnershipId] Creating profile for user:', user.id)
      const { error: createProfileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || null,
          city: user.user_metadata?.city || 'New York',
          msa_status: user.user_metadata?.msa_status || 'live',
          survey_complete: false
        })

      if (createProfileError && createProfileError.code !== '23505') { // Ignore unique violation
        console.error('[getCurrentPartnershipId] Failed to create profile:', createProfileError)
      }
    }

    // Create new partnership for solo user
    const { data: partnership, error: createError } = await supabase
      .from('partnerships')
      .insert({
        owner_id: user.id,
        city: profile?.city || user.user_metadata?.city || 'New York',
        membership_tier: 'free'
        // advocate_mode: false, // This field doesn't exist yet in the database
        // profile_state: 'draft' // This field doesn't exist yet in the database
      })
      .select()
      .single()

    if (createError || !partnership) {
      console.error('[getCurrentPartnershipId] Failed to create partnership:', createError)
      return { id: null, error: 'Failed to create partnership' }
    }

    console.log('[getCurrentPartnershipId] Created new partnership:', partnership.id)

    // Add user as owner member
    const { error: memberError } = await supabase
      .from('partnership_members')
      .insert({
        partnership_id: partnership.id,
        user_id: user.id,
        role: 'owner'
      })

    if (memberError) {
      console.error('[getCurrentPartnershipId] Failed to add member:', memberError)
      return { id: null, error: 'Failed to add member' }
    }

    // Create empty survey response
    const { error: surveyError } = await supabase
      .from('survey_responses')
      .insert({
        partnership_id: partnership.id,
        answers_json: {},
        completion_pct: 0
        // current_step: 0 // This field doesn't exist yet in the database
      })

    if (surveyError) {
      console.error('[getCurrentPartnershipId] Failed to create survey response:', surveyError)
    }

    return { id: partnership.id, error: null }
  } catch (error) {
    console.error('[getCurrentPartnershipId] Unexpected error:', error)
    return { id: null, error: 'An unexpected error occurred' }
  }
}

/**
 * Server action to update partnership
 */
export async function updatePartnership(
  partnershipId: string,
  updates: Partial<Database['public']['Tables']['partnerships']['Update']>
): Promise<{ success: boolean, error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('partnerships')
    .update(updates)
    .eq('id', partnershipId)

  if (error) {
    console.error('[updatePartnership] Error:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}