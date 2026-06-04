/**
 * Deterministic Partnership Selection
 *
 * When a user has multiple partnerships, this helper selects the "active" one:
 *
 * ACTIVE PARTNERSHIP RULE:
 * 1. If user has any partnerships with profile_state = 'live'
 *    → select the most recently updated LIVE partnership
 * 2. Else
 *    → select the most recently updated partnership overall
 * 3. Never auto-create a partnership during read
 * 4. Never return an arbitrary draft partnership if a live one exists
 *
 * This ensures all user-facing flows (dashboard, discovery, profile, connections)
 * operate on the same, correct partnership.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SelectedPartnership {
  partnership_id: string
  user_id: string
  role: 'owner' | 'member'
  survey_reviewed: boolean
  joined_at: string
  membership_tier: 'free' | 'pro' | 'plus'
  profile_state: 'draft' | 'pending' | 'live'
}

/**
 * Select the active partnership for a user from potentially multiple memberships.
 *
 * ACTIVE PARTNERSHIP RULE:
 * 1. LIVE partnerships first (profile_state = 'live')
 * 2. Then by updated_at DESC (most recently updated)
 * 3. Never return a draft if a live exists
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
        profile_state,
        updated_at
      )
    `)
    .eq('user_id', userId)

  if (error) {
    console.error('[selectBestPartnership] Error fetching memberships:', error.message)
    return null
  }

  if (!memberships || memberships.length === 0) {
    return null
  }

  // Sort memberships: LIVE first, then by updated_at DESC
  const sortedMemberships = [...memberships].sort((a, b) => {
    const partnershipA = a.partnerships as any
    const partnershipB = b.partnerships as any

    const stateA = partnershipA?.profile_state || 'draft'
    const stateB = partnershipB?.profile_state || 'draft'

    // LIVE partnerships come first
    if (stateA === 'live' && stateB !== 'live') return -1
    if (stateB === 'live' && stateA !== 'live') return 1

    // Within same state, sort by updated_at DESC
    const updatedA = new Date(partnershipA?.updated_at || 0).getTime()
    const updatedB = new Date(partnershipB?.updated_at || 0).getTime()
    return updatedB - updatedA
  })

  // Select the first (best) partnership
  const selected = sortedMemberships[0]
  const partnership = selected.partnerships as any

  const result: SelectedPartnership = {
    partnership_id: selected.partnership_id,
    user_id: selected.user_id,
    role: selected.role as 'owner' | 'member',
    survey_reviewed: selected.survey_reviewed || false,
    joined_at: selected.joined_at,
    membership_tier: partnership?.membership_tier || 'free',
    profile_state: partnership?.profile_state || 'draft'
  }

  // Instrumentation log for verification
  console.log('[ACTIVE_PARTNERSHIP_SELECTED]', {
    userId,
    partnershipId: result.partnership_id,
    profile_state: result.profile_state,
    totalPartnerships: memberships.length
  })

  return result
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
