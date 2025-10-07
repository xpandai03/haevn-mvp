import { createClient } from '@/lib/supabase/client'

/**
 * Partnership Stats Utility Functions
 *
 * Calculate real-time stats for a partnership:
 * - Matches: Potential compatible partnerships (calculated from matching algorithm)
 * - Nudges: One-way signals sent to this partnership
 * - Connections: Mutual handshakes with other partnerships
 * - Profile Views: Not tracked yet (returns 0 for now)
 */

export interface PartnershipStats {
  matches: number
  nudges: number
  connections: number
  profileViews: number
}

/**
 * Get count of potential matches for a partnership
 * Note: This is a placeholder - should call matching algorithm
 */
export async function getMatchesCount(partnershipId: string): Promise<number> {
  const supabase = createClient()

  try {
    // TODO: Implement actual matching algorithm
    // For now, count all other active partnerships in same city
    const { data: partnership } = await supabase
      .from('partnerships')
      .select('city')
      .eq('id', partnershipId)
      .single()

    if (!partnership?.city) return 0

    const { count } = await supabase
      .from('partnerships')
      .select('*', { count: 'exact', head: true })
      .eq('city', partnership.city)
      .neq('id', partnershipId)

    return count || 0
  } catch (error) {
    console.error('Error getting matches count:', error)
    return 0
  }
}

/**
 * Get count of nudges (signals) received by this partnership
 */
export async function getNudgesCount(partnershipId: string): Promise<number> {
  const supabase = createClient()

  try {
    const { count } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('to_partnership', partnershipId)

    return count || 0
  } catch (error) {
    console.error('Error getting nudges count:', error)
    return 0
  }
}

/**
 * Get count of connections (handshakes) for this partnership
 */
export async function getConnectionsCount(partnershipId: string): Promise<number> {
  const supabase = createClient()

  try {
    // Handshakes can have this partnership in either position (a or b)
    const { count: countA } = await supabase
      .from('handshakes')
      .select('*', { count: 'exact', head: true })
      .eq('a_partnership', partnershipId)

    const { count: countB } = await supabase
      .from('handshakes')
      .select('*', { count: 'exact', head: true })
      .eq('b_partnership', partnershipId)

    return (countA || 0) + (countB || 0)
  } catch (error) {
    console.error('Error getting connections count:', error)
    return 0
  }
}

/**
 * Get count of profile views
 * Note: Not currently tracked in the database
 */
export async function getProfileViewsCount(partnershipId: string): Promise<number> {
  // TODO: Implement profile views tracking
  // This would require a new table or adding view events
  return 0
}

/**
 * Get all stats for a partnership at once
 */
export async function getPartnershipStats(partnershipId: string): Promise<PartnershipStats> {
  const [matches, nudges, connections, profileViews] = await Promise.all([
    getMatchesCount(partnershipId),
    getNudgesCount(partnershipId),
    getConnectionsCount(partnershipId),
    getProfileViewsCount(partnershipId)
  ])

  return {
    matches,
    nudges,
    connections,
    profileViews
  }
}
