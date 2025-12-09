'use server'

/**
 * Match Actions
 *
 * Server actions for Connect/Pass functionality in external matching.
 * These wrap the handshakes system with a simpler interface for the match detail page.
 */

import { sendHandshakeRequest, canSendHandshake } from './handshakes'
import { getMatchStatusV2 } from './matching'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// TYPES
// =============================================================================

export interface ActionResult {
  success: boolean
  error?: string
}

export type MatchStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'dismissed'

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

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Send a connection request to a match.
 *
 * This creates a handshake with the current user's consent set to true.
 *
 * @param matchPartnershipId - The partnership ID to connect with
 * @param compatibilityScore - The compatibility score to store with the handshake
 */
export async function sendConnectionRequest(
  matchPartnershipId: string,
  compatibilityScore?: number
): Promise<ActionResult> {
  try {
    // Check if we can send
    const { canSend, reason } = await canSendHandshake(matchPartnershipId)
    if (!canSend) {
      return { success: false, error: reason }
    }

    // Send the handshake request
    const result = await sendHandshakeRequest(
      matchPartnershipId,
      undefined, // No message for now
      compatibilityScore
    )

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[sendConnectionRequest] Error:', error)
    return { success: false, error: error.message || 'Failed to send connection request' }
  }
}

/**
 * Pass on a match (dismiss without connecting).
 *
 * This creates a dismissed handshake record so the match won't appear again.
 *
 * @param matchPartnershipId - The partnership ID to pass on
 */
export async function passOnMatch(
  matchPartnershipId: string
): Promise<ActionResult> {
  try {
    const adminClient = await createAdminClient()
    const currentPartnershipId = await getCurrentPartnershipId()

    // Check if handshake already exists
    const { data: existing } = await adminClient
      .from('handshakes')
      .select('id, state')
      .or(`and(a_partnership.eq.${currentPartnershipId},b_partnership.eq.${matchPartnershipId}),and(a_partnership.eq.${matchPartnershipId},b_partnership.eq.${currentPartnershipId})`)

    if (existing && existing.length > 0) {
      // Update existing handshake to dismissed
      const { error: updateError } = await adminClient
        .from('handshakes')
        .update({ state: 'dismissed' })
        .eq('id', existing[0].id)

      if (updateError) {
        console.error('[passOnMatch] Update error:', updateError)
        return { success: false, error: updateError.message }
      }

      return { success: true }
    }

    // Create new dismissed handshake
    // Ensure consistent ordering (lower UUID first)
    const [a_partnership, b_partnership] =
      currentPartnershipId < matchPartnershipId
        ? [currentPartnershipId, matchPartnershipId]
        : [matchPartnershipId, currentPartnershipId]

    const { error: insertError } = await adminClient
      .from('handshakes')
      .insert({
        a_partnership,
        b_partnership,
        a_consent: false,
        b_consent: false,
        state: 'dismissed',
        triggered_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('[passOnMatch] Insert error:', insertError)
      return { success: false, error: insertError.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[passOnMatch] Error:', error)
    return { success: false, error: error.message || 'Failed to pass on match' }
  }
}

/**
 * Get the current status of a match relationship.
 *
 * Convenience wrapper around getMatchStatusV2.
 *
 * @param matchPartnershipId - The partnership ID to check
 */
export async function getMatchStatus(
  matchPartnershipId: string
): Promise<MatchStatus> {
  return getMatchStatusV2(matchPartnershipId)
}

/**
 * Check if connection is possible with a match.
 *
 * @param matchPartnershipId - The partnership ID to check
 */
export async function canConnect(
  matchPartnershipId: string
): Promise<{ canConnect: boolean; reason?: string }> {
  const status = await getMatchStatus(matchPartnershipId)

  switch (status) {
    case 'none':
      return { canConnect: true }
    case 'pending_sent':
      return { canConnect: false, reason: 'Connection request already sent' }
    case 'pending_received':
      return { canConnect: false, reason: 'They sent you a request - respond instead' }
    case 'connected':
      return { canConnect: false, reason: 'Already connected' }
    case 'dismissed':
      return { canConnect: false, reason: 'Match was dismissed' }
    default:
      return { canConnect: false, reason: 'Unknown status' }
  }
}
