'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Partnership profile data for preview
 */
export interface PartnershipProfileData {
  id: string
  display_name: string | null
  short_bio: string | null
  long_bio: string | null
  intentions: string[] | null
  lifestyle_tags: string[] | null
  structure: { type: string; open_to?: string[] } | null
  orientation: { value: string; seeking?: string[] } | null
  profile_type: string | null
  city: string | null
  age: number | null
  photos: Array<{
    id: string
    photo_url: string
    photo_type: string
    is_primary: boolean
  }>
}

/**
 * Get the current user's full partnership profile data for preview
 */
export async function getMyPartnershipProfile(): Promise<{ data: PartnershipProfileData | null, error: string | null }> {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[getMyPartnershipProfile] No authenticated user')
      return { data: null, error: 'Not authenticated' }
    }

    const adminClient = await createAdminClient()

    // Get user's partnership membership
    const { data: membership, error: memberError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError || !membership) {
      console.error('[getMyPartnershipProfile] No partnership found')
      return { data: null, error: 'No partnership found' }
    }

    // Get full partnership data
    const { data: partnership, error: partnershipError } = await adminClient
      .from('partnerships')
      .select(`
        id,
        display_name,
        short_bio,
        long_bio,
        intentions,
        lifestyle_tags,
        structure,
        orientation,
        profile_type,
        city,
        age
      `)
      .eq('id', membership.partnership_id)
      .single()

    if (partnershipError || !partnership) {
      console.error('[getMyPartnershipProfile] Failed to get partnership:', partnershipError)
      return { data: null, error: 'Failed to load partnership' }
    }

    // Get photos
    const { data: photos } = await adminClient
      .from('partnership_photos')
      .select('id, photo_url, photo_type, is_primary')
      .eq('partnership_id', membership.partnership_id)
      .eq('photo_type', 'public')
      .order('is_primary', { ascending: false })
      .order('order_index', { ascending: true })

    return {
      data: {
        ...partnership,
        photos: photos || []
      },
      error: null
    }
  } catch (error) {
    console.error('[getMyPartnershipProfile] Unexpected error:', error)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * Simplified partnership getter that uses database function
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

    // Use the database function to get or create partnership
    const { data, error } = await supabase
      .rpc('get_or_create_partnership', { p_user_id: user.id })
      .single()

    if (error) {
      console.error('[getCurrentPartnershipId] Database function error:', error)

      // Fallback: Try to get existing partnership
      const { data: partnership } = await supabase
        .from('partnerships')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (partnership) {
        return { id: partnership.id, error: null }
      }

      // Last resort: Create manually
      const { data: newPartnership, error: createError } = await supabase
        .from('partnerships')
        .insert({
          owner_id: user.id,
          city: 'New York',
          membership_tier: 'free'
        })
        .select('id')
        .single()

      if (createError || !newPartnership) {
        console.error('[getCurrentPartnershipId] Failed to create partnership:', createError)
        return { id: null, error: 'Failed to create partnership' }
      }

      return { id: newPartnership.id, error: null }
    }

    if (data?.partnership_id) {
      console.log('[getCurrentPartnershipId] Success:', data.partnership_id)
      return { id: data.partnership_id, error: null }
    }

    return { id: null, error: 'No partnership found' }
  } catch (error) {
    console.error('[getCurrentPartnershipId] Unexpected error:', error)
    return { id: null, error: 'An unexpected error occurred' }
  }
}