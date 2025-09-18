import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/supabase'

type Partnership = Database['public']['Tables']['partnerships']['Row']

/**
 * Get the current partnership ID for a logged-in user
 * Creates one if it doesn't exist (for solo users)
 */
export async function getCurrentPartnershipId(userId: string): Promise<string> {
  const supabase = createClient()

  try {
    // Check if user already belongs to a partnership
    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .single()

    if (membership?.partnership_id) {
      return membership.partnership_id
    }

    // If no partnership exists, create one for solo user
    const { data: profile } = await supabase
      .from('profiles')
      .select('city, full_name')
      .eq('user_id', userId)
      .single()

    const { data: partnership, error: createError } = await supabase
      .from('partnerships')
      .insert({
        owner_id: userId,
        city: profile?.city || 'New York',
        membership_tier: 'free',
        advocate_mode: false,
        profile_state: 'draft'
      })
      .select()
      .single()

    if (createError || !partnership) {
      throw new Error('Failed to create partnership')
    }

    // Add user as owner member
    await supabase
      .from('partnership_members')
      .insert({
        partnership_id: partnership.id,
        user_id: userId,
        role: 'owner'
      })

    // Create empty survey response
    await supabase
      .from('survey_responses')
      .insert({
        partnership_id: partnership.id,
        answers_json: {},
        completion_pct: 0,
        current_step: 0
      })

    return partnership.id
  } catch (error) {
    console.error('[getCurrentPartnershipId] Error:', error)
    throw new Error('Failed to get or create partnership')
  }
}

/**
 * Get partnership details
 */
export async function getPartnership(partnershipId: string): Promise<Partnership | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('partnerships')
    .select('*')
    .eq('id', partnershipId)
    .single()

  if (error) {
    console.error('[getPartnership] Error:', error)
    return null
  }

  return data
}

/**
 * Update partnership fields
 */
export async function updatePartnership(
  partnershipId: string,
  updates: Partial<Database['public']['Tables']['partnerships']['Update']>
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('partnerships')
    .update(updates)
    .eq('id', partnershipId)

  if (error) {
    console.error('[updatePartnership] Error:', error)
    return false
  }

  return true
}