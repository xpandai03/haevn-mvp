'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface ComputedMatch {
  partnership_a: string
  partnership_b: string
  score: number
  tier: string
}

/**
 * Fetch computed matches for a partnership BIDIRECTIONALLY.
 * Uses admin client to bypass RLS (which only checks partnership_a).
 *
 * This ensures matches are returned regardless of which side
 * the user's partnership is on.
 */
export async function getComputedMatchesForPartnership(
  partnershipId: string
): Promise<{ matches: ComputedMatch[]; error: string | null }> {
  try {
    const adminClient = createAdminClient()

    // Query BIDIRECTIONALLY - user can be partnership_a OR partnership_b
    const { data: matches, error } = await adminClient
      .from('computed_matches')
      .select('partnership_a, partnership_b, score, tier')
      .or(`partnership_a.eq.${partnershipId},partnership_b.eq.${partnershipId}`)

    if (error) {
      console.error('[getComputedMatches] Query error:', error)
      return { matches: [], error: error.message }
    }

    console.log('[getComputedMatches] Found', matches?.length || 0, 'matches for partnership:', partnershipId)

    return { matches: matches || [], error: null }
  } catch (err: any) {
    console.error('[getComputedMatches] Error:', err)
    return { matches: [], error: err.message }
  }
}
