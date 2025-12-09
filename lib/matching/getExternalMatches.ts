/**
 * External Matching Service
 *
 * Server-side functions to fetch, score, and rank external matches
 * using the NEW 5-category matching engine.
 *
 * This service is used for discovery - finding compatible partnerships
 * outside the user's own partnership.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculateCompatibility,
  normalizeAnswers,
  type RawAnswers,
  type CompatibilityResult,
  type CompatibilityTier,
  type CategoryScore,
} from '@/lib/matching'

// =============================================================================
// TYPES
// =============================================================================

/**
 * External match result with partnership info and compatibility scores
 */
export interface ExternalMatchResult {
  partnership: {
    id: string
    display_name: string | null
    short_bio: string | null
    identity: string
    profile_type: 'solo' | 'couple' | 'pod'
    city: string
    age: number
    photo_url?: string
  }
  compatibility: {
    overallScore: number
    tier: CompatibilityTier
    categories: CategoryScore[]
    lifestyleIncluded: boolean
    constraintsPassed: boolean
    constraintReason?: string
  }
}

/**
 * Partnership data from database
 */
interface PartnershipData {
  id: string
  display_name: string | null
  short_bio: string | null
  identity: string
  profile_type: 'solo' | 'couple' | 'pod'
  city: string
  msa: string | null
  age: number
}

/**
 * Survey response from database
 */
interface SurveyResponse {
  user_id: string
  answers_json: RawAnswers | null
  completion_pct: number
}

/**
 * Photo from database
 */
interface PartnershipPhoto {
  partnership_id: string
  storage_path: string | null
  photo_url: string | null
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get current user's partnership ID
 */
async function getCurrentPartnershipId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const adminClient = await createAdminClient()
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
 * Get survey answers for all members of a partnership
 * Returns merged answers for couples/pods, or single user answers for solo
 */
async function getPartnershipAnswers(
  adminClient: ReturnType<typeof createAdminClient>,
  partnershipId: string
): Promise<RawAnswers | null> {
  // Get all members of the partnership
  const { data: members } = await adminClient
    .from('partnership_members')
    .select('user_id')
    .eq('partnership_id', partnershipId)

  if (!members || members.length === 0) {
    return null
  }

  // Get survey responses for all members
  const memberIds = members.map(m => m.user_id)
  const { data: surveys } = await adminClient
    .from('user_survey_responses')
    .select('user_id, answers_json, completion_pct')
    .in('user_id', memberIds)

  if (!surveys || surveys.length === 0) {
    return null
  }

  // Find a completed survey (at least one member must have completed)
  const completedSurvey = surveys.find(s => s.completion_pct >= 100 && s.answers_json)

  if (!completedSurvey || !completedSurvey.answers_json) {
    return null
  }

  // For now, use the first completed survey's answers
  // In future, could merge answers from multiple members
  return completedSurvey.answers_json as RawAnswers
}

/**
 * Get existing handshake IDs to exclude from matches
 */
async function getExcludedPartnershipIds(
  adminClient: ReturnType<typeof createAdminClient>,
  partnershipId: string
): Promise<Set<string>> {
  const excluded = new Set<string>()

  // Get all existing handshakes (pending, matched, or dismissed)
  const { data: handshakes } = await adminClient
    .from('handshakes')
    .select('a_partnership, b_partnership')
    .or(`a_partnership.eq.${partnershipId},b_partnership.eq.${partnershipId}`)

  if (handshakes) {
    for (const h of handshakes) {
      if (h.a_partnership !== partnershipId) {
        excluded.add(h.a_partnership)
      }
      if (h.b_partnership !== partnershipId) {
        excluded.add(h.b_partnership)
      }
    }
  }

  return excluded
}

/**
 * Get primary photo URL for a partnership
 */
async function getPartnershipPhotoUrl(
  adminClient: ReturnType<typeof createAdminClient>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  partnershipId: string
): Promise<string | undefined> {
  const { data: photoData } = await adminClient
    .from('partnership_photos')
    .select('storage_path')
    .eq('partnership_id', partnershipId)
    .eq('is_primary', true)
    .eq('photo_type', 'public')
    .maybeSingle()

  if (photoData?.storage_path) {
    const { data: { publicUrl } } = supabase
      .storage
      .from('partnership-photos')
      .getPublicUrl(photoData.storage_path)
    return publicUrl
  }

  return undefined
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get ranked external matches using the NEW 5-category matching engine.
 *
 * @param minTier - Minimum tier to include (default: 'Bronze')
 * @param limit - Maximum number of matches to return (default: 50)
 * @returns Array of matches sorted by score descending
 */
export async function getExternalMatches(
  minTier: CompatibilityTier = 'Bronze',
  limit: number = 50
): Promise<ExternalMatchResult[]> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // 1. Get current user's partnership
  const currentPartnershipId = await getCurrentPartnershipId()

  // 2. Get current partnership details
  const { data: currentPartnership, error: currentError } = await adminClient
    .from('partnerships')
    .select('id, profile_type, city, msa')
    .eq('id', currentPartnershipId)
    .single()

  if (currentError || !currentPartnership) {
    console.error('[getExternalMatches] Failed to fetch current partnership:', currentError)
    return []
  }

  // 3. Get current partnership's survey answers
  const currentAnswers = await getPartnershipAnswers(adminClient, currentPartnershipId)
  if (!currentAnswers) {
    console.warn('[getExternalMatches] Current partnership has no completed survey')
    return []
  }

  // 4. Get excluded partnership IDs (existing handshakes)
  const excludedIds = await getExcludedPartnershipIds(adminClient, currentPartnershipId)
  excludedIds.add(currentPartnershipId) // Also exclude self

  // 5. Fetch potential matches (same city/MSA, with display_name)
  const { data: potentialMatches, error: matchesError } = await adminClient
    .from('partnerships')
    .select('id, display_name, short_bio, identity, profile_type, city, msa, age')
    .not('display_name', 'is', null)
    .neq('id', currentPartnershipId)

  if (matchesError || !potentialMatches) {
    console.error('[getExternalMatches] Failed to fetch potential matches:', matchesError)
    return []
  }

  // 6. Filter by location (same city or MSA) and exclusions
  const locationFilteredMatches = potentialMatches.filter(p => {
    // Exclude already-interacted partnerships
    if (excludedIds.has(p.id)) return false

    // Same city match
    if (p.city && currentPartnership.city && p.city === currentPartnership.city) {
      return true
    }

    // Same MSA match (if both have MSA)
    if (p.msa && currentPartnership.msa && p.msa === currentPartnership.msa) {
      return true
    }

    // For now, also include matches without location restriction for testing
    // TODO: Remove this fallback in production
    return true
  })

  // 7. Score each potential match
  const scoredMatches: ExternalMatchResult[] = []
  const currentIsCouple = currentPartnership.profile_type === 'couple'

  for (const match of locationFilteredMatches) {
    // Get match's survey answers
    const matchAnswers = await getPartnershipAnswers(adminClient, match.id)
    if (!matchAnswers) {
      continue // Skip matches without completed surveys
    }

    const matchIsCouple = match.profile_type === 'couple'

    // Calculate compatibility using NEW engine
    const result = calculateCompatibility({
      partnerA: {
        partnershipId: currentPartnershipId,
        userId: '', // Not needed for external matching
        answers: normalizeAnswers(currentAnswers),
        isCouple: currentIsCouple,
      },
      partnerB: {
        partnershipId: match.id,
        userId: '', // Not needed for external matching
        answers: normalizeAnswers(matchAnswers),
        isCouple: matchIsCouple,
      },
    })

    // Skip if constraints failed (blocked match)
    if (!result.constraints.passed) {
      continue
    }

    // Filter by minimum tier
    const tierOrder: CompatibilityTier[] = ['Platinum', 'Gold', 'Silver', 'Bronze']
    const minTierIndex = tierOrder.indexOf(minTier)
    const resultTierIndex = tierOrder.indexOf(result.tier)
    if (resultTierIndex > minTierIndex) {
      continue // Score too low for requested tier
    }

    // Get photo URL
    const photoUrl = await getPartnershipPhotoUrl(adminClient, supabase, match.id)

    scoredMatches.push({
      partnership: {
        id: match.id,
        display_name: match.display_name,
        short_bio: match.short_bio,
        identity: match.identity || 'Unknown',
        profile_type: (match.profile_type as 'solo' | 'couple' | 'pod') || 'solo',
        city: match.city || 'Unknown',
        age: match.age || 0,
        photo_url: photoUrl,
      },
      compatibility: {
        overallScore: result.overallScore,
        tier: result.tier,
        categories: result.categories,
        lifestyleIncluded: result.lifestyleIncluded,
        constraintsPassed: result.constraints.passed,
        constraintReason: result.constraints.reason,
      },
    })
  }

  // 8. Sort by score descending and limit
  scoredMatches.sort((a, b) => b.compatibility.overallScore - a.compatibility.overallScore)

  return scoredMatches.slice(0, limit)
}

/**
 * Get details for a specific external match.
 *
 * @param matchPartnershipId - The partnership ID to get details for
 * @returns Match details with full compatibility breakdown, or null if not found
 */
export async function getExternalMatchDetails(
  matchPartnershipId: string
): Promise<ExternalMatchResult | null> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // 1. Get current user's partnership
  const currentPartnershipId = await getCurrentPartnershipId()

  // 2. Get current partnership details
  const { data: currentPartnership } = await adminClient
    .from('partnerships')
    .select('id, profile_type')
    .eq('id', currentPartnershipId)
    .single()

  if (!currentPartnership) {
    return null
  }

  // 3. Get match partnership details
  const { data: matchPartnership } = await adminClient
    .from('partnerships')
    .select('id, display_name, short_bio, identity, profile_type, city, age')
    .eq('id', matchPartnershipId)
    .single()

  if (!matchPartnership) {
    return null
  }

  // 4. Get both partnership's survey answers
  const currentAnswers = await getPartnershipAnswers(adminClient, currentPartnershipId)
  const matchAnswers = await getPartnershipAnswers(adminClient, matchPartnershipId)

  if (!currentAnswers || !matchAnswers) {
    return null
  }

  const currentIsCouple = currentPartnership.profile_type === 'couple'
  const matchIsCouple = matchPartnership.profile_type === 'couple'

  // 5. Calculate compatibility
  const result = calculateCompatibility({
    partnerA: {
      partnershipId: currentPartnershipId,
      userId: '',
      answers: normalizeAnswers(currentAnswers),
      isCouple: currentIsCouple,
    },
    partnerB: {
      partnershipId: matchPartnershipId,
      userId: '',
      answers: normalizeAnswers(matchAnswers),
      isCouple: matchIsCouple,
    },
  })

  // 6. Get photo URL
  const photoUrl = await getPartnershipPhotoUrl(adminClient, supabase, matchPartnershipId)

  return {
    partnership: {
      id: matchPartnership.id,
      display_name: matchPartnership.display_name,
      short_bio: matchPartnership.short_bio,
      identity: matchPartnership.identity || 'Unknown',
      profile_type: (matchPartnership.profile_type as 'solo' | 'couple' | 'pod') || 'solo',
      city: matchPartnership.city || 'Unknown',
      age: matchPartnership.age || 0,
      photo_url: photoUrl,
    },
    compatibility: {
      overallScore: result.overallScore,
      tier: result.tier,
      categories: result.categories,
      lifestyleIncluded: result.lifestyleIncluded,
      constraintsPassed: result.constraints.passed,
      constraintReason: result.constraints.reason,
    },
  }
}

/**
 * Get the status of a potential match (for UI display)
 */
export async function getMatchStatus(
  matchPartnershipId: string
): Promise<'none' | 'pending_sent' | 'pending_received' | 'connected' | 'dismissed'> {
  const adminClient = await createAdminClient()
  const currentPartnershipId = await getCurrentPartnershipId()

  // Query handshakes in both directions
  const { data: handshakes } = await adminClient
    .from('handshakes')
    .select('a_partnership, b_partnership, a_consent, b_consent, state')
    .or(`and(a_partnership.eq.${currentPartnershipId},b_partnership.eq.${matchPartnershipId}),and(a_partnership.eq.${matchPartnershipId},b_partnership.eq.${currentPartnershipId})`)

  if (!handshakes || handshakes.length === 0) {
    return 'none'
  }

  const handshake = handshakes[0]

  // Check if dismissed
  if (handshake.state === 'dismissed') {
    return 'dismissed'
  }

  // Check if matched (both consented)
  if (handshake.a_consent && handshake.b_consent && handshake.state === 'matched') {
    return 'connected'
  }

  // Determine direction
  const isInitiator = handshake.a_partnership === currentPartnershipId
    ? handshake.a_consent
    : handshake.b_consent

  return isInitiator ? 'pending_sent' : 'pending_received'
}
