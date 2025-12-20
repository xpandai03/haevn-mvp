'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface HandshakeData {
  id: string
  a_partnership: string
  b_partnership: string
  a_consent: boolean
  b_consent: boolean
  match_score: number | null
  state: 'viewed' | 'matched' | 'dismissed'
  triggered_at: string
  matched_at: string | null
  partnership_a?: any
  partnership_b?: any
}

/**
 * Get current user's partnership ID
 */
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
    throw new Error(`No partnership found for user`)
  }

  const primaryMembership = memberships.find(m => m.role === 'owner') || memberships[0]
  return primaryMembership.partnership_id
}

/**
 * Check if handshake can be sent to a partnership
 */
export async function canSendHandshake(
  toPartnershipId: string
): Promise<{ canSend: boolean; reason?: string }> {
  try {
    const adminClient = createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    // Cannot handshake with self
    if (currentPartnershipId === toPartnershipId) {
      return { canSend: false, reason: 'Cannot handshake with yourself' }
    }

    // Check if handshake already exists (in either direction)
    const { data: existingHandshakes } = await adminClient
      .from('handshakes')
      .select('id, state, a_consent, b_consent')
      .or(`and(a_partnership.eq.${currentPartnershipId},b_partnership.eq.${toPartnershipId}),and(a_partnership.eq.${toPartnershipId},b_partnership.eq.${currentPartnershipId})`)

    if (existingHandshakes && existingHandshakes.length > 0) {
      const handshake = existingHandshakes[0]

      if (handshake.a_consent && handshake.b_consent) {
        return { canSend: false, reason: 'Already connected' }
      }

      if (handshake.state === 'dismissed') {
        return { canSend: false, reason: 'Handshake was declined' }
      }

      return { canSend: false, reason: 'Handshake request already pending' }
    }

    return { canSend: true }
  } catch (error: any) {
    console.error('[canSendHandshake] Error:', error)
    return { canSend: false, reason: error.message }
  }
}

/**
 * Send a handshake request to another partnership
 */
export async function sendHandshakeRequest(
  toPartnershipId: string,
  message?: string,
  matchScore?: number
): Promise<{ success: boolean; error?: string; handshakeId?: string }> {
  try {
    const adminClient = createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    // Check if can send
    const { canSend, reason } = await canSendHandshake(toPartnershipId)
    if (!canSend) {
      return { success: false, error: reason }
    }

    // Ensure consistent ordering (lower UUID first)
    const [a_partnership, b_partnership] =
      currentPartnershipId < toPartnershipId
        ? [currentPartnershipId, toPartnershipId]
        : [toPartnershipId, currentPartnershipId]

    const isInitiator = currentPartnershipId === a_partnership

    // Insert handshake
    const { data: handshake, error: insertError } = await adminClient
      .from('handshakes')
      .insert({
        a_partnership,
        b_partnership,
        a_consent: isInitiator,
        b_consent: !isInitiator,
        match_score: matchScore || null,
        state: 'viewed',
        triggered_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('[sendHandshakeRequest] Insert error:', insertError)
      return { success: false, error: insertError.message }
    }

    console.log('[sendHandshakeRequest] Handshake created:', handshake.id)
    return { success: true, handshakeId: handshake.id }
  } catch (error: any) {
    console.error('[sendHandshakeRequest] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Respond to a handshake request (accept or decline)
 */
export async function respondToHandshake(
  handshakeId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    // Fetch handshake to verify user is the receiver
    const { data: handshake, error: fetchError } = await adminClient
      .from('handshakes')
      .select('*')
      .eq('id', handshakeId)
      .single()

    if (fetchError || !handshake) {
      return { success: false, error: 'Handshake not found' }
    }

    // Determine which side the current user is on
    const isPartnershipA = handshake.a_partnership === currentPartnershipId
    const isPartnershipB = handshake.b_partnership === currentPartnershipId

    if (!isPartnershipA && !isPartnershipB) {
      return { success: false, error: 'Not authorized to respond to this handshake' }
    }

    // Check if user is the receiver (the one who hasn't consented yet)
    const hasAlreadyConsented = isPartnershipA ? handshake.a_consent : handshake.b_consent
    if (hasAlreadyConsented) {
      return { success: false, error: 'You have already responded to this handshake' }
    }

    if (accept) {
      // Set consent and check if both have now consented
      const updateData: any = isPartnershipA
        ? { a_consent: true }
        : { b_consent: true }

      const otherSideConsented = isPartnershipA ? handshake.b_consent : handshake.a_consent

      if (otherSideConsented) {
        // Both consented - mark as matched
        updateData.state = 'matched'
        updateData.matched_at = new Date().toISOString()
      }

      const { error: updateError } = await adminClient
        .from('handshakes')
        .update(updateData)
        .eq('id', handshakeId)

      if (updateError) {
        console.error('[respondToHandshake] Update error:', updateError)
        return { success: false, error: updateError.message }
      }

      console.log('[respondToHandshake] Handshake accepted:', handshakeId)
      return { success: true }
    } else {
      // Decline - mark as dismissed
      const { error: updateError } = await adminClient
        .from('handshakes')
        .update({ state: 'dismissed' })
        .eq('id', handshakeId)

      if (updateError) {
        console.error('[respondToHandshake] Decline error:', updateError)
        return { success: false, error: updateError.message }
      }

      console.log('[respondToHandshake] Handshake declined:', handshakeId)
      return { success: true }
    }
  } catch (error: any) {
    console.error('[respondToHandshake] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get incoming handshake requests (where user needs to respond)
 */
export async function getIncomingHandshakes(): Promise<HandshakeData[]> {
  try {
    const adminClient = createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    const { data: handshakes, error } = await adminClient
      .from('handshakes')
      .select(`
        *,
        partnership_a:a_partnership(id, display_name, short_bio, city, age, identity),
        partnership_b:b_partnership(id, display_name, short_bio, city, age, identity)
      `)
      .or(`and(a_partnership.eq.${currentPartnershipId},a_consent.eq.false),and(b_partnership.eq.${currentPartnershipId},b_consent.eq.false)`)
      .neq('state', 'dismissed')
      .order('triggered_at', { ascending: false })

    if (error) {
      console.error('[getIncomingHandshakes] Error:', error)
      return []
    }

    return handshakes || []
  } catch (error: any) {
    console.error('[getIncomingHandshakes] Error:', error)
    return []
  }
}

/**
 * Get outgoing handshake requests (sent by user)
 */
export async function getOutgoingHandshakes(): Promise<HandshakeData[]> {
  try {
    const adminClient = createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    const { data: handshakes, error } = await adminClient
      .from('handshakes')
      .select(`
        *,
        partnership_a:a_partnership(id, display_name, short_bio, city, age, identity),
        partnership_b:b_partnership(id, display_name, short_bio, city, age, identity)
      `)
      .or(`and(a_partnership.eq.${currentPartnershipId},a_consent.eq.true),and(b_partnership.eq.${currentPartnershipId},b_consent.eq.true)`)
      .neq('state', 'matched')
      .order('triggered_at', { ascending: false })

    if (error) {
      console.error('[getOutgoingHandshakes] Error:', error)
      return []
    }

    return handshakes || []
  } catch (error: any) {
    console.error('[getOutgoingHandshakes] Error:', error)
    return []
  }
}

/**
 * Get all connections (accepted handshakes)
 */
export async function getConnections(): Promise<HandshakeData[]> {
  try {
    const adminClient = createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    const { data: handshakes, error } = await adminClient
      .from('handshakes')
      .select(`
        *,
        partnership_a:a_partnership(id, display_name, short_bio, long_bio, city, age, identity, orientation, structure, intentions),
        partnership_b:b_partnership(id, display_name, short_bio, long_bio, city, age, identity, orientation, structure, intentions)
      `)
      .or(`a_partnership.eq.${currentPartnershipId},b_partnership.eq.${currentPartnershipId}`)
      .eq('a_consent', true)
      .eq('b_consent', true)
      .eq('state', 'matched')
      .order('matched_at', { ascending: false })

    if (error) {
      console.error('[getConnections] Error:', error)
      return []
    }

    return handshakes || []
  } catch (error: any) {
    console.error('[getConnections] Error:', error)
    return []
  }
}

/**
 * Get count of incoming handshake requests
 */
export async function getIncomingHandshakeCount(): Promise<number> {
  try {
    const incoming = await getIncomingHandshakes()
    return incoming.length
  } catch (error) {
    console.error('[getIncomingHandshakeCount] Error:', error)
    return 0
  }
}

/**
 * Connection card data for UI display
 */
export interface ConnectionCardData {
  id: string // handshake id
  partnershipId: string
  displayName: string
  city: string | null
  age: number | null
  identity: string | null
  photoUrl: string | null
  compatibilityScore: number
  topFactor: string
  matchedAt: string | null
}

/**
 * Get connections with enriched data for UI cards
 * Returns the "other" partnership's info with photos
 */
export async function getConnectionCards(): Promise<ConnectionCardData[]> {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    const { data: handshakes, error } = await adminClient
      .from('handshakes')
      .select(`
        id,
        a_partnership,
        b_partnership,
        match_score,
        matched_at,
        partnership_a:a_partnership(id, display_name, city, age, identity),
        partnership_b:b_partnership(id, display_name, city, age, identity)
      `)
      .or(`a_partnership.eq.${currentPartnershipId},b_partnership.eq.${currentPartnershipId}`)
      .eq('a_consent', true)
      .eq('b_consent', true)
      .eq('state', 'matched')
      .order('matched_at', { ascending: false })

    if (error) {
      console.error('[getConnectionCards] Error:', error)
      return []
    }

    if (!handshakes || handshakes.length === 0) {
      return []
    }

    // Process each connection to get the "other" partnership and their photo
    const connectionCards: ConnectionCardData[] = []

    for (const handshake of handshakes) {
      // Determine which partnership is the OTHER one
      const isCurrentA = handshake.a_partnership === currentPartnershipId
      const otherPartnership = isCurrentA
        ? (handshake.partnership_b as any)
        : (handshake.partnership_a as any)

      if (!otherPartnership) continue

      // Get photo for the other partnership
      const { data: photoData } = await adminClient
        .from('partnership_photos')
        .select('storage_path')
        .eq('partnership_id', otherPartnership.id)
        .eq('is_primary', true)
        .eq('photo_type', 'public')
        .maybeSingle()

      let photoUrl: string | null = null
      if (photoData?.storage_path) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('partnership-photos')
          .getPublicUrl(photoData.storage_path)
        photoUrl = publicUrl
      }

      // Determine top compatibility factor based on score
      const score = handshake.match_score || 0
      let topFactor = 'Compatible'
      if (score >= 85) topFactor = 'Great Match'
      else if (score >= 70) topFactor = 'Strong Connection'
      else if (score >= 55) topFactor = 'Good Fit'

      connectionCards.push({
        id: handshake.id,
        partnershipId: otherPartnership.id,
        displayName: otherPartnership.display_name || 'User',
        city: otherPartnership.city,
        age: otherPartnership.age,
        identity: otherPartnership.identity,
        photoUrl,
        compatibilityScore: handshake.match_score || 0,
        topFactor,
        matchedAt: handshake.matched_at
      })
    }

    return connectionCards
  } catch (error: any) {
    console.error('[getConnectionCards] Error:', error)
    return []
  }
}
