'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Update the current user's profile
 */
export async function updateProfile(data: {
  full_name?: string
  city?: string
  msa_status?: 'live' | 'waitlist'
}) {
  const supabase = await createClient()

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[updateProfile] No authenticated user')
      return { success: false, error: 'Not authenticated' }
    }

    // Update profile
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('user_id', user.id)

    if (error) {
      console.error('[updateProfile] Error updating profile:', error)
      return { success: false, error: error.message }
    }

    console.log('[updateProfile] Profile updated successfully')
    return { success: true, error: null }
  } catch (error) {
    console.error('[updateProfile] Unexpected error:', error)
    return { success: false, error: 'Failed to update profile' }
  }
}