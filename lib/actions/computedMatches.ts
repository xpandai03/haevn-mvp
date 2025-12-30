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
    const queryFilter = `partnership_a.eq.${partnershipId},partnership_b.eq.${partnershipId}`
    console.log('[MATCH_DEBUG_QUERY]', {
      partnershipId,
      queryFilter,
    })

    const { data: matches, error } = await adminClient
      .from('computed_matches')
      .select('partnership_a, partnership_b, score, tier')
      .or(queryFilter)

    // Log raw DB result BEFORE any processing
    console.log('[MATCH_DEBUG_RAW]', {
      partnershipId,
      rawCount: matches?.length ?? 'null',
      error: error?.message ?? null,
      rawRows: matches?.map(r => ({
        a: r.partnership_a,
        b: r.partnership_b,
        score: r.score,
        tier: r.tier,
      })),
    })

    if (error) {
      console.error('[getComputedMatches] Query error:', error)
      return { matches: [], error: error.message }
    }

    // Log final result (no filtering in this function)
    console.log('[MATCH_DEBUG_FINAL]', {
      partnershipId,
      finalCount: matches?.length || 0,
    })

    return { matches: matches || [], error: null }
  } catch (err: any) {
    console.error('[getComputedMatches] Error:', err)
    return { matches: [], error: err.message }
  }
}
