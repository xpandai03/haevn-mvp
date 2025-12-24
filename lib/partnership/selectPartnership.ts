/**
 * Deterministic Partnership Selection
 *
 * When a user has multiple partnerships, this helper selects the "best" one:
 * 1. Prefer partnerships where membership_tier = 'pro'
 * 2. Fall back to most recently created partnership
 *
 * This is a TEMPORARY fix for testing - eventually users should be able
 * to explicitly switch between partnerships.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SelectedPartnership {
  partnership_id: string
  user_id: string
  role: 'owner' | 'member'
  survey_reviewed: boolean
  joined_at: string
  membership_tier: 'free' | 'pro' | 'plus'
}

/**
 * Select the best partnership for a user from potentially multiple memberships.
 *
 * Priority:
 * 1. Pro/Plus tier partnership
 * 2. Most recently joined partnership
 *
 * @param supabase - Supabase client (can be user client or admin client)
 * @param userId - The user ID to find partnership for
 * @returns The selected partnership membership, or null if none exists
 */
export async function selectBestPartnership(
  supabase: SupabaseClient,
  userId: string
): Promise<SelectedPartnership | null> {
  // Fetch ALL partnership memberships for this user, joined with partnership details
  const { data: memberships, error } = await supabase
    .from('partnership_members')
    .select(`
      partnership_id,
      user_id,
      role,
      survey_reviewed,
      joined_at,
      partnerships!inner (
        id,
        membership_tier,
        created_at
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('[selectBestPartnership] Error fetching memberships:', error.message)
    return null
  }

  if (!memberships || memberships.length === 0) {
    return null
  }

  console.log(`[selectBestPartnership] User ${userId} has ${memberships.length} partnership(s)`)

  // If only one membership, return it
  if (memberships.length === 1) {
    const m = memberships[0]
    const partnership = m.partnerships as any
    return {
      partnership_id: m.partnership_id,
      user_id: m.user_id,
      role: m.role as 'owner' | 'member',
      survey_reviewed: m.survey_reviewed || false,
      joined_at: m.joined_at,
      membership_tier: partnership?.membership_tier || 'free'
    }
  }

  // Multiple memberships - find the best one
  // Priority 1: Pro/Plus tier
  const proMembership = memberships.find(m => {
    const partnership = m.partnerships as any
    return partnership?.membership_tier === 'pro' || partnership?.membership_tier === 'plus'
  })

  if (proMembership) {
    const partnership = proMembership.partnerships as any
    console.log(`[selectBestPartnership] Selected PRO partnership: ${proMembership.partnership_id}`)
    return {
      partnership_id: proMembership.partnership_id,
      user_id: proMembership.user_id,
      role: proMembership.role as 'owner' | 'member',
      survey_reviewed: proMembership.survey_reviewed || false,
      joined_at: proMembership.joined_at,
      membership_tier: partnership?.membership_tier || 'pro'
    }
  }

  // Priority 2: Most recently joined (first in array due to order)
  const mostRecent = memberships[0]
  const partnership = mostRecent.partnerships as any
  console.log(`[selectBestPartnership] Selected most recent partnership: ${mostRecent.partnership_id}`)
  return {
    partnership_id: mostRecent.partnership_id,
    user_id: mostRecent.user_id,
    role: mostRecent.role as 'owner' | 'member',
    survey_reviewed: mostRecent.survey_reviewed || false,
    joined_at: mostRecent.joined_at,
    membership_tier: partnership?.membership_tier || 'free'
  }
}

/**
 * Lightweight version that only returns basic membership info
 * (for use in middleware where we don't need full partnership details)
 */
export async function selectBestPartnershipBasic(
  supabase: SupabaseClient,
  userId: string
): Promise<{ partnership_id: string; role: string; survey_reviewed: boolean } | null> {
  const result = await selectBestPartnership(supabase, userId)
  if (!result) return null

  return {
    partnership_id: result.partnership_id,
    role: result.role,
    survey_reviewed: result.survey_reviewed
  }
}
