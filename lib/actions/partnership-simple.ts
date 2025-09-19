'use server'

import { createClient } from '@/lib/supabase/server'

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