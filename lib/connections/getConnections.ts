/**
 * Connections Data Loader
 *
 * Server-side functions to fetch all active connections with full
 * compatibility breakdown using the NEW 5-category matching engine.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import {
  calculateCompatibilityFromRaw,
  type RawAnswers,
  type CompatibilityTier,
  type CategoryScore,
} from '@/lib/matching'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Connection result with partnership info and compatibility scores
 */
export interface ConnectionResult {
  handshakeId: string
  matchedAt: string
  partnership: {
    id: string
    display_name: string | null
    short_bio: string | null
    long_bio: string | null
    identity: string
    profile_type: 'solo' | 'couple' | 'pod'
    city: string
    age: number
    photo_url?: string
    structure: { type: string; open_to?: string[] } | null
    intentions: string[] | null
    lifestyle_tags: string[] | null
    orientation: { value: string; seeking?: string[] } | null
    photos: ConnectionPhoto[]
  }
  compatibility: {
    overallScore: number
    tier: CompatibilityTier
    categories: CategoryScore[]
    lifestyleIncluded: boolean
  }
}

/**
 * Raw handshake data from database
 */
interface HandshakeRow {
  id: string
  a_partnership: string
  b_partnership: string
  match_score: number | null
  matched_at: string | null
  partnership_a: PartnershipRow | null
  partnership_b: PartnershipRow | null
}

/**
 * Partnership data from database
 */
interface PartnershipRow {
  id: string
  display_name: string | null
  short_bio: string | null
  long_bio: string | null
  identity: string | null
  profile_type: string | null
  city: string | null
  age: number | null
  structure: { type: string; open_to?: string[] } | null
  intentions: string[] | null
  lifestyle_tags: string[] | null
  orientation: { value: string; seeking?: string[] } | null
}

/**
 * Photo data for connected profiles
 */
export interface ConnectionPhoto {
  id: string
  photo_url: string
  photo_type: 'public' | 'private'
  order_index: number
  is_primary: boolean
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get current user's partnership ID using canonical selectBestPartnership
 */
async function getCurrentPartnershipId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const adminClient = await createAdminClient()

  // Use canonical selectBestPartnership for consistency across all flows
  const selected = await selectBestPartnership(adminClient, user.id)

  if (!selected) {
    throw new Error('No partnership found for user')
  }

  return selected.partnership_id
}

/**
 * Get survey answers for all members of a partnership
 */
async function getPartnershipAnswers(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
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

  return completedSurvey.answers_json as RawAnswers
}

/**
 * Get primary photo URL for a partnership
 */
async function getPartnershipPhotoUrl(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
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

/**
 * Get all photos for a partnership (server-side, bypasses RLS)
 */
async function getPartnershipPhotosAdmin(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  partnershipId: string
): Promise<ConnectionPhoto[]> {
  const { data: photos, error } = await adminClient
    .from('partnership_photos')
    .select('id, photo_url, photo_type, order_index, is_primary')
    .eq('partnership_id', partnershipId)
    .eq('photo_type', 'public')
    .order('order_index', { ascending: true })

  if (error || !photos) {
    console.error('[getPartnershipPhotosAdmin] Error:', error)
    return []
  }

  return photos.map(photo => ({
    id: photo.id,
    photo_url: photo.photo_url,
    photo_type: photo.photo_type as 'public' | 'private',
    order_index: photo.order_index,
    is_primary: photo.is_primary,
  }))
}

/**
 * Calculate compatibility between two partnerships
 */
async function calculateConnectionCompatibility(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  currentPartnershipId: string,
  currentProfileType: string,
  otherPartnershipId: string,
  otherProfileType: string,
  fallbackScore?: number | null
): Promise<{
  overallScore: number
  tier: CompatibilityTier
  categories: CategoryScore[]
  lifestyleIncluded: boolean
} | null> {
  // Get both partnerships' survey answers
  const currentAnswers = await getPartnershipAnswers(adminClient, currentPartnershipId)
  const otherAnswers = await getPartnershipAnswers(adminClient, otherPartnershipId)

  // If we can't get survey answers, use fallback score from handshake
  if (!currentAnswers || !otherAnswers) {
    if (fallbackScore !== null && fallbackScore !== undefined) {
      // Create a basic result from the stored score
      const tier: CompatibilityTier =
        fallbackScore >= 85 ? 'Platinum' :
        fallbackScore >= 70 ? 'Gold' :
        fallbackScore >= 55 ? 'Silver' : 'Bronze'

      return {
        overallScore: fallbackScore,
        tier,
        categories: [], // No category breakdown available
        lifestyleIncluded: false,
      }
    }
    return null
  }

  const currentIsCouple = currentProfileType === 'couple'
  const otherIsCouple = otherProfileType === 'couple'

  // Calculate compatibility using unified pipeline
  // calculateCompatibilityFromRaw handles normalization internally
  const result = calculateCompatibilityFromRaw(
    currentAnswers,
    otherAnswers,
    currentIsCouple,
    otherIsCouple
  )

  return {
    overallScore: result.overallScore,
    tier: result.tier,
    categories: result.categories,
    lifestyleIncluded: result.lifestyleIncluded,
  }
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get all connections with full compatibility breakdown.
 *
 * @returns Array of connections sorted by matched_at descending
 */
export async function getConnectionsWithCompatibility(): Promise<ConnectionResult[]> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // 1. Get current user's partnership
  const currentPartnershipId = await getCurrentPartnershipId()

  // 2. Get current partnership's profile_type
  const { data: currentPartnership } = await adminClient
    .from('partnerships')
    .select('id, profile_type')
    .eq('id', currentPartnershipId)
    .single()

  if (!currentPartnership) {
    console.error('[getConnectionsWithCompatibility] Current partnership not found')
    return []
  }

  // 3. Query all matched handshakes
  const { data: handshakes, error } = await adminClient
    .from('handshakes')
    .select(`
      id,
      a_partnership,
      b_partnership,
      match_score,
      matched_at,
      partnership_a:a_partnership(id, display_name, short_bio, long_bio, identity, profile_type, city, age, structure, intentions, lifestyle_tags, orientation),
      partnership_b:b_partnership(id, display_name, short_bio, long_bio, identity, profile_type, city, age, structure, intentions, lifestyle_tags, orientation)
    `)
    .or(`a_partnership.eq.${currentPartnershipId},b_partnership.eq.${currentPartnershipId}`)
    .eq('a_consent', true)
    .eq('b_consent', true)
    .eq('state', 'matched')
    .order('matched_at', { ascending: false })

  if (error) {
    console.error('[getConnectionsWithCompatibility] Error fetching handshakes:', error)
    return []
  }

  if (!handshakes || handshakes.length === 0) {
    return []
  }

  // 4. Process each connection
  const connections: ConnectionResult[] = []

  for (const handshake of handshakes as unknown as HandshakeRow[]) {
    // Determine which partnership is the OTHER one (not current user)
    const isCurrentPartnershipA = handshake.a_partnership === currentPartnershipId
    const otherPartnership = isCurrentPartnershipA
      ? handshake.partnership_b
      : handshake.partnership_a

    if (!otherPartnership) {
      continue
    }

    // Calculate compatibility using NEW engine
    const compatibility = await calculateConnectionCompatibility(
      adminClient,
      currentPartnershipId,
      currentPartnership.profile_type || 'solo',
      otherPartnership.id,
      otherPartnership.profile_type || 'solo',
      handshake.match_score
    )

    if (!compatibility) {
      // If we can't calculate, skip this connection
      continue
    }

    // Get photo URL and all photos
    const photoUrl = await getPartnershipPhotoUrl(adminClient, supabase, otherPartnership.id)
    const photos = await getPartnershipPhotosAdmin(adminClient, supabase, otherPartnership.id)

    connections.push({
      handshakeId: handshake.id,
      matchedAt: handshake.matched_at || new Date().toISOString(),
      partnership: {
        id: otherPartnership.id,
        display_name: otherPartnership.display_name,
        short_bio: otherPartnership.short_bio,
        long_bio: otherPartnership.long_bio,
        identity: otherPartnership.identity || 'Unknown',
        profile_type: (otherPartnership.profile_type as 'solo' | 'couple' | 'pod') || 'solo',
        city: otherPartnership.city || 'Unknown',
        age: otherPartnership.age || 0,
        photo_url: photoUrl,
        structure: otherPartnership.structure,
        intentions: otherPartnership.intentions,
        lifestyle_tags: otherPartnership.lifestyle_tags,
        orientation: otherPartnership.orientation,
        photos,
      },
      compatibility,
    })
  }

  return connections
}

/**
 * Get details for a specific connection.
 *
 * @param connectionId - Either the handshake ID or the other partnership's ID
 * @returns Connection details with full compatibility breakdown, or null if not found
 */
export async function getConnectionDetails(
  connectionId: string
): Promise<ConnectionResult | null> {
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // 1. Get current user's partnership
  const currentPartnershipId = await getCurrentPartnershipId()

  // 2. Get current partnership's profile_type
  const { data: currentPartnership } = await adminClient
    .from('partnerships')
    .select('id, profile_type')
    .eq('id', currentPartnershipId)
    .single()

  if (!currentPartnership) {
    return null
  }

  // 3. Try to find the handshake - connectionId could be handshake ID or partnership ID
  let handshake: HandshakeRow | null = null

  // First try as handshake ID
  const { data: byHandshakeId } = await adminClient
    .from('handshakes')
    .select(`
      id,
      a_partnership,
      b_partnership,
      match_score,
      matched_at,
      partnership_a:a_partnership(id, display_name, short_bio, long_bio, identity, profile_type, city, age, structure, intentions, lifestyle_tags, orientation),
      partnership_b:b_partnership(id, display_name, short_bio, long_bio, identity, profile_type, city, age, structure, intentions, lifestyle_tags, orientation)
    `)
    .eq('id', connectionId)
    .eq('a_consent', true)
    .eq('b_consent', true)
    .eq('state', 'matched')
    .maybeSingle()

  if (byHandshakeId) {
    handshake = byHandshakeId as unknown as HandshakeRow
  } else {
    // Try as partnership ID (the other partnership)
    const { data: byPartnershipId } = await adminClient
      .from('handshakes')
      .select(`
        id,
        a_partnership,
        b_partnership,
        match_score,
        matched_at,
        partnership_a:a_partnership(id, display_name, short_bio, long_bio, identity, profile_type, city, age, structure, intentions, lifestyle_tags, orientation),
        partnership_b:b_partnership(id, display_name, short_bio, long_bio, identity, profile_type, city, age, structure, intentions, lifestyle_tags, orientation)
      `)
      .or(`and(a_partnership.eq.${currentPartnershipId},b_partnership.eq.${connectionId}),and(a_partnership.eq.${connectionId},b_partnership.eq.${currentPartnershipId})`)
      .eq('a_consent', true)
      .eq('b_consent', true)
      .eq('state', 'matched')
      .maybeSingle()

    if (byPartnershipId) {
      handshake = byPartnershipId as unknown as HandshakeRow
    }
  }

  if (!handshake) {
    return null
  }

  // 4. Verify this handshake involves current user
  const isCurrentPartnershipA = handshake.a_partnership === currentPartnershipId
  const isCurrentPartnershipB = handshake.b_partnership === currentPartnershipId

  if (!isCurrentPartnershipA && !isCurrentPartnershipB) {
    return null // Not authorized
  }

  // 5. Get the OTHER partnership
  const otherPartnership = isCurrentPartnershipA
    ? handshake.partnership_b
    : handshake.partnership_a

  if (!otherPartnership) {
    return null
  }

  // 6. Calculate compatibility
  const compatibility = await calculateConnectionCompatibility(
    adminClient,
    currentPartnershipId,
    currentPartnership.profile_type || 'solo',
    otherPartnership.id,
    otherPartnership.profile_type || 'solo',
    handshake.match_score
  )

  if (!compatibility) {
    return null
  }

  // 7. Get photo URL and all photos
  const photoUrl = await getPartnershipPhotoUrl(adminClient, supabase, otherPartnership.id)
  const photos = await getPartnershipPhotosAdmin(adminClient, supabase, otherPartnership.id)

  return {
    handshakeId: handshake.id,
    matchedAt: handshake.matched_at || new Date().toISOString(),
    partnership: {
      id: otherPartnership.id,
      display_name: otherPartnership.display_name,
      short_bio: otherPartnership.short_bio,
      long_bio: otherPartnership.long_bio,
      identity: otherPartnership.identity || 'Unknown',
      profile_type: (otherPartnership.profile_type as 'solo' | 'couple' | 'pod') || 'solo',
      city: otherPartnership.city || 'Unknown',
      age: otherPartnership.age || 0,
      photo_url: photoUrl,
      structure: otherPartnership.structure,
      intentions: otherPartnership.intentions,
      lifestyle_tags: otherPartnership.lifestyle_tags,
      orientation: otherPartnership.orientation,
      photos,
    },
    compatibility,
  }
}
