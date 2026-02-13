'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// =============================================================================
// TYPES
// =============================================================================

export interface ComputedMatchCard {
  partnership: {
    id: string
    display_name: string | null
    short_bio: string | null
    identity: string
    city: string
    age: number
    photo_url?: string
  }
  score: number
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  /** Category breakdown keyed by display key (goals_expectations, etc.) */
  breakdown: Record<string, { score: number }>
}

/**
 * Map engine category names to MatchProfileView display keys.
 */
const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  intent: 'goals_expectations',
  structure: 'structure_fit',
  connection: 'boundaries_comfort',
  lifestyle: 'openness_curiosity',
  chemistry: 'sexual_energy',
}

// =============================================================================
// HELPERS
// =============================================================================

async function getCurrentPartnershipId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const adminClient = createAdminClient()
  const { data: memberships, error } = await adminClient
    .from('partnership_members')
    .select('partnership_id, role')
    .eq('user_id', user.id)
    .order('role', { ascending: false })

  if (error || !memberships || memberships.length === 0) {
    throw new Error('No partnership found for user')
  }

  const primaryMembership = memberships.find(m => m.role === 'owner') || memberships[0]
  return primaryMembership.partnership_id
}

/**
 * Parse the engine's category breakdown (stored as array) into display keys.
 */
function parseBreakdown(raw: any): Record<string, { score: number }> {
  const sections: Record<string, { score: number }> = {}
  if (!raw) return sections

  // breakdown is stored as CategoryScore[] from the engine
  const categories = Array.isArray(raw) ? raw : []
  for (const cat of categories) {
    const displayKey = CATEGORY_DISPLAY_MAP[cat.category] || cat.category
    sections[displayKey] = { score: Math.round(cat.score ?? 0) }
  }

  return sections
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Fetch precomputed match cards from computed_matches table.
 *
 * This is the ONLY data source for match display in the UI.
 * No dynamic recomputation — reads what computeMatchesForPartnership() stored.
 *
 * @param minTier - Minimum tier to include (default: 'Bronze')
 * @param limit - Maximum number of matches to return (default: 50)
 */
export async function getComputedMatchCards(
  minTier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze' = 'Bronze',
  limit: number = 50
): Promise<ComputedMatchCard[]> {
  const adminClient = createAdminClient()
  const currentPartnershipId = await getCurrentPartnershipId()

  // 1. Fetch computed matches for this partnership (bidirectional)
  const { data: matches, error: matchError } = await adminClient
    .from('computed_matches')
    .select('partnership_a, partnership_b, score, tier, breakdown')
    .or(`partnership_a.eq.${currentPartnershipId},partnership_b.eq.${currentPartnershipId}`)
    .order('score', { ascending: false })
    .limit(limit * 2) // Fetch extra since we have bidirectional rows

  if (matchError || !matches || matches.length === 0) {
    if (matchError) console.error('[getComputedMatchCards] Query error:', matchError)
    return []
  }

  // 2. Deduplicate — keep only rows where we can identify the "other" partnership
  //    and filter by minimum tier
  const tierOrder = ['Platinum', 'Gold', 'Silver', 'Bronze'] as const
  const minTierIndex = tierOrder.indexOf(minTier)
  const seenPartnerIds = new Set<string>()

  const filteredMatches: Array<{
    otherPartnerId: string
    score: number
    tier: string
    breakdown: any
  }> = []

  for (const m of matches) {
    const otherId = m.partnership_a === currentPartnershipId
      ? m.partnership_b
      : m.partnership_a

    // Deduplicate
    if (seenPartnerIds.has(otherId)) continue
    seenPartnerIds.add(otherId)

    // Filter by tier
    const resultTierIndex = tierOrder.indexOf(m.tier as any)
    if (resultTierIndex === -1 || resultTierIndex > minTierIndex) continue

    filteredMatches.push({
      otherPartnerId: otherId,
      score: m.score,
      tier: m.tier,
      breakdown: m.breakdown,
    })
  }

  if (filteredMatches.length === 0) return []

  // 3. Fetch partner profile data in one query
  const partnerIds = filteredMatches.map(m => m.otherPartnerId)
  const { data: partnerships } = await adminClient
    .from('partnerships')
    .select('id, display_name, short_bio, identity, city, age')
    .in('id', partnerIds)

  const partnershipMap = new Map(
    (partnerships || []).map(p => [p.id, p])
  )

  // 4. Fetch photo URLs in one query
  const supabase = await createClient()
  const { data: photos } = await adminClient
    .from('partnership_photos')
    .select('partnership_id, storage_path')
    .in('partnership_id', partnerIds)
    .eq('is_primary', true)
    .eq('photo_type', 'public')

  const photoMap = new Map<string, string>()
  if (photos) {
    for (const photo of photos) {
      if (photo.storage_path) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('partnership-photos')
          .getPublicUrl(photo.storage_path)
        photoMap.set(photo.partnership_id, publicUrl)
      }
    }
  }

  // 5. Assemble results, sorted by score desc, limited
  const results: ComputedMatchCard[] = []
  for (const match of filteredMatches) {
    const partner = partnershipMap.get(match.otherPartnerId)
    if (!partner) continue // Partner no longer exists or not live

    results.push({
      partnership: {
        id: partner.id,
        display_name: partner.display_name,
        short_bio: partner.short_bio,
        identity: partner.identity || 'Unknown',
        city: partner.city || 'Unknown',
        age: partner.age || 0,
        photo_url: photoMap.get(partner.id),
      },
      score: match.score,
      tier: match.tier as 'Platinum' | 'Gold' | 'Silver' | 'Bronze',
      breakdown: parseBreakdown(match.breakdown),
    })
  }

  // Already sorted by score from DB, but ensure after dedup
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}
