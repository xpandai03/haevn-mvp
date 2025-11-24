/**
 * Dashboard Data Actions
 * Server actions for fetching dashboard stats and data
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Get dashboard stats for the current user
 * Returns counts for matches, messages, connections, and profile views
 */
export async function getDashboardStats() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  try {
    // Get matches count (from existing getMatches function)
    // For now, return stub data - will be properly implemented
    const matchesCount = 0

    // Get unread messages count
    const { count: newMessagesCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_user', user.id)
      .is('read_at', null)

    // Get connections count (handshakes with messages)
    const { count: connectionsCount } = await supabase
      .from('handshakes')
      .select('*', { count: 'exact', head: true })
      .or(`a_partnership.eq.${user.id},b_partnership.eq.${user.id}`)

    // Get profile views count
    const { count: profileViews } = await supabase
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('viewed_profile_id', user.id)

    return {
      matchesCount: matchesCount || 0,
      newMessagesCount: newMessagesCount || 0,
      connectionsCount: connectionsCount || 0,
      profileViews: profileViews || 0
    }
  } catch (error) {
    console.error('[getDashboardStats] Error:', error)
    return {
      matchesCount: 0,
      newMessagesCount: 0,
      connectionsCount: 0,
      profileViews: 0
    }
  }
}

/**
 * Get user membership tier
 */
export async function getUserMembershipTier(): Promise<'free' | 'plus'> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return 'free'
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_tier')
      .eq('user_id', user.id)
      .single()

    return profile?.membership_tier === 'plus' ? 'plus' : 'free'
  } catch (error) {
    console.error('[getUserMembershipTier] Error:', error)
    return 'free'
  }
}

/**
 * Get user profile photo URL
 */
export async function getUserProfilePhoto(): Promise<string | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  try {
    // Get partnership for this user
    const { data: partnership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .single()

    if (!partnership) {
      return null
    }

    // Get primary photo for partnership
    const { data: photo } = await supabase
      .from('partnership_photos')
      .select('storage_path')
      .eq('partnership_id', partnership.partnership_id)
      .eq('is_primary', true)
      .eq('photo_type', 'public')
      .single()

    if (!photo) {
      return null
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('partnership-photos')
      .getPublicUrl(photo.storage_path)

    return publicUrl
  } catch (error) {
    console.error('[getUserProfilePhoto] Error:', error)
    return null
  }
}
