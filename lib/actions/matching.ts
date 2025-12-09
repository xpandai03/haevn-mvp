'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateMatch, calculateMatches, UserProfile, MatchScore } from '@/lib/matching/scoring'
import {
  getExternalMatches as getExternalMatchesService,
  getExternalMatchDetails as getExternalMatchDetailsService,
  getMatchStatus as getMatchStatusService,
  type ExternalMatchResult,
} from '@/lib/matching/getExternalMatches'
import type { CompatibilityTier } from '@/lib/matching'

// Re-export types for consumers
export type { ExternalMatchResult } from '@/lib/matching/getExternalMatches'
export type { CompatibilityTier } from '@/lib/matching'

export interface MatchResult {
  partnership: {
    id: string
    display_name: string | null
    short_bio: string | null
    identity: string
    city: string
    age: number
    discretion_level: string
  }
  score: number
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  breakdown: any
}

/**
 * Get current user's partnership
 */
async function getCurrentPartnership() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  console.log('[getCurrentPartnership] Auth check:', {
    user: user?.id,
    email: user?.email,
    authError: authError?.message
  })

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  // Use admin client to bypass RLS for partnership_members query
  const adminClient = createAdminClient()

  const { data: memberships, error: membershipError } = await adminClient
    .from('partnership_members')
    .select('partnership_id, role')
    .eq('user_id', user.id)
    .order('role', { ascending: false }) // 'owner' comes before other roles alphabetically

  console.log('[getCurrentPartnership] Membership query (admin):', {
    userId: user.id,
    memberships,
    count: memberships?.length,
    error: membershipError?.message
  })

  if (membershipError || !memberships || memberships.length === 0) {
    throw new Error(`No partnership found for user ${user.id}. Error: ${membershipError?.message}`)
  }

  // Use the first partnership (prefer owner role if available)
  const primaryMembership = memberships.find(m => m.role === 'owner') || memberships[0]

  console.log('[getCurrentPartnership] Using partnership:', primaryMembership)

  return primaryMembership.partnership_id
}

/**
 * Fetch matches for the current user
 */
export async function getMatches(minTier: MatchScore['tier'] = 'Bronze'): Promise<MatchResult[]> {
  const adminClient = createAdminClient()
  const partnershipId = await getCurrentPartnership()

  // Fetch current user's partnership data using admin client to bypass RLS
  const { data: currentPartnership, error: currentError } = await adminClient
    .from('partnerships')
    .select(`
      id,
      identity,
      seeking_targets,
      age,
      city,
      state,
      msa,
      zip_code,
      discretion_level,
      is_verified,
      has_background_check,
      profile_completeness,
      survey_responses (answers_json)
    `)
    .eq('id', partnershipId)
    .single()

  console.log('[getMatches] Current partnership query:', {
    partnershipId,
    found: !!currentPartnership,
    error: currentError?.message
  })

  if (currentError || !currentPartnership) {
    throw new Error(`Failed to fetch current partnership: ${currentError?.message}`)
  }

  // Build UserProfile from current partnership
  const currentProfile: UserProfile = {
    id: currentPartnership.id,
    identity: currentPartnership.identity,
    seeking_targets: currentPartnership.seeking_targets,
    age: currentPartnership.age,
    location: {
      city: currentPartnership.city,
      state: currentPartnership.state,
      msa: currentPartnership.msa,
      zip_code: currentPartnership.zip_code,
    },
    structure: (currentPartnership.survey_responses as any)?.[0]?.answers_json?.structure,
    intent: (currentPartnership.survey_responses as any)?.[0]?.answers_json?.intent,
    discretion_level: currentPartnership.discretion_level,
    is_verified: currentPartnership.is_verified,
    has_background_check: currentPartnership.has_background_check,
    profile_completeness: currentPartnership.profile_completeness,
  }

  // Fetch all other partnerships as potential matches using admin client
  // For MVP: fetch all, filter client-side. For production: add more DB filters
  const { data: potentialMatches, error: matchesError } = await adminClient
    .from('partnerships')
    .select(`
      id,
      display_name,
      short_bio,
      identity,
      seeking_targets,
      age,
      city,
      state,
      msa,
      zip_code,
      discretion_level,
      is_verified,
      has_background_check,
      profile_completeness,
      survey_responses (answers_json)
    `)
    .neq('id', partnershipId) // Exclude self
    .not('display_name', 'is', null) // Only show profiles with names

  if (matchesError) {
    throw new Error(`Failed to fetch potential matches: ${matchesError.message}`)
  }

  // Convert to UserProfile format
  const potentialProfiles: UserProfile[] = (potentialMatches || []).map((p: any) => ({
    id: p.id,
    identity: p.identity,
    seeking_targets: p.seeking_targets,
    age: p.age,
    location: {
      city: p.city,
      state: p.state,
      msa: p.msa,
      zip_code: p.zip_code,
    },
    structure: p.survey_responses?.[0]?.answers_json?.structure,
    intent: p.survey_responses?.[0]?.answers_json?.intent,
    discretion_level: p.discretion_level,
    is_verified: p.is_verified,
    has_background_check: p.has_background_check,
    profile_completeness: p.profile_completeness,
  }))

  // Calculate matches using scoring engine
  const matches = calculateMatches(currentProfile, potentialProfiles, minTier)

  // Map to MatchResult format
  const results: MatchResult[] = matches.map(({ match, score }) => {
    const partnershipData = potentialMatches!.find((p: any) => p.id === match.id)!
    return {
      partnership: {
        id: partnershipData.id,
        display_name: partnershipData.display_name,
        short_bio: partnershipData.short_bio,
        identity: partnershipData.identity,
        city: partnershipData.city,
        age: partnershipData.age,
        discretion_level: partnershipData.discretion_level,
      },
      score: score.score,
      tier: score.tier as any,
      breakdown: score.breakdown,
    }
  })

  return results
}

/**
 * Get a specific match with full details
 */
export async function getMatchDetails(matchId: string) {
  const adminClient = createAdminClient()
  const currentPartnershipId = await getCurrentPartnership()

  // Fetch both partnerships using admin client to bypass RLS
  const { data: partnerships, error } = await adminClient
    .from('partnerships')
    .select(`
      id,
      display_name,
      short_bio,
      long_bio,
      identity,
      seeking_targets,
      age,
      city,
      state,
      msa,
      zip_code,
      discretion_level,
      is_verified,
      has_background_check,
      profile_completeness,
      orientation,
      structure,
      intentions,
      lifestyle_tags,
      survey_responses (answers_json)
    `)
    .in('id', [currentPartnershipId, matchId])

  if (error || !partnerships || partnerships.length !== 2) {
    throw new Error(`Failed to fetch match details: ${error?.message}`)
  }

  const currentPartnership = partnerships.find(p => p.id === currentPartnershipId)!
  const matchPartnership = partnerships.find(p => p.id === matchId)!

  // Build profiles
  const currentProfile: UserProfile = {
    id: currentPartnership.id,
    identity: currentPartnership.identity,
    seeking_targets: currentPartnership.seeking_targets,
    age: currentPartnership.age,
    location: {
      city: currentPartnership.city,
      state: currentPartnership.state,
      msa: currentPartnership.msa,
      zip_code: currentPartnership.zip_code,
    },
    structure: (currentPartnership.survey_responses as any)?.[0]?.answers_json?.structure,
    intent: (currentPartnership.survey_responses as any)?.[0]?.answers_json?.intent,
    discretion_level: currentPartnership.discretion_level,
    is_verified: currentPartnership.is_verified,
    has_background_check: currentPartnership.has_background_check,
    profile_completeness: currentPartnership.profile_completeness,
  }

  const matchProfile: UserProfile = {
    id: matchPartnership.id,
    identity: matchPartnership.identity,
    seeking_targets: matchPartnership.seeking_targets,
    age: matchPartnership.age,
    location: {
      city: matchPartnership.city,
      state: matchPartnership.state,
      msa: matchPartnership.msa,
      zip_code: matchPartnership.zip_code,
    },
    structure: (matchPartnership.survey_responses as any)?.[0]?.answers_json?.structure,
    intent: (matchPartnership.survey_responses as any)?.[0]?.answers_json?.intent,
    discretion_level: matchPartnership.discretion_level,
    is_verified: matchPartnership.is_verified,
    has_background_check: matchPartnership.has_background_check,
    profile_completeness: matchPartnership.profile_completeness,
  }

  // Calculate score
  const score = calculateMatch(currentProfile, matchProfile)

  return {
    partnership: matchPartnership,
    score,
  }
}

// =============================================================================
// V2 FUNCTIONS - Using NEW 5-category matching engine
// =============================================================================

/**
 * Get external matches using the NEW 5-category matching engine.
 *
 * This function replaces the legacy `getMatches()` for external discovery.
 * It uses the same engine as internal compatibility but for partnerships.
 *
 * @param minTier - Minimum tier to include (default: 'Bronze')
 * @param limit - Maximum number of matches to return (default: 50)
 */
export async function getMatchesV2(
  minTier: CompatibilityTier = 'Bronze',
  limit: number = 50
): Promise<ExternalMatchResult[]> {
  return getExternalMatchesService(minTier, limit)
}

/**
 * Get details for a specific match using the NEW 5-category engine.
 *
 * @param matchId - The partnership ID to get details for
 */
export async function getMatchDetailsV2(
  matchId: string
): Promise<ExternalMatchResult | null> {
  return getExternalMatchDetailsService(matchId)
}

/**
 * Get the current status of a match relationship.
 *
 * @param matchId - The partnership ID to check status for
 */
export async function getMatchStatusV2(
  matchId: string
): Promise<'none' | 'pending_sent' | 'pending_received' | 'connected' | 'dismissed'> {
  return getMatchStatusService(matchId)
}
