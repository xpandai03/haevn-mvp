'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { isSyntheticPartnership, isTestAccount } from './config'

/**
 * Check if a new handshake should trigger synthetic auto-accept.
 * Called after a handshake is created.
 *
 * This enables deterministic testing of the core flow:
 * Discovery → Match → Connect → Accept → Profile View → Chat
 *
 * @param handshakeId - The newly created handshake ID
 * @param fromUserId - The user who initiated the connection
 * @returns Whether the handshake was auto-accepted
 */
export async function checkSyntheticAutoAccept(
  handshakeId: string,
  fromUserId: string
): Promise<{ autoAccepted: boolean }> {
  // Only activate for test accounts
  if (!isTestAccount(fromUserId)) {
    return { autoAccepted: false }
  }

  const adminClient = createAdminClient()

  // Fetch the handshake
  const { data: handshake, error } = await adminClient
    .from('handshakes')
    .select('id, a_partnership, b_partnership, a_consent, b_consent')
    .eq('id', handshakeId)
    .single()

  if (error || !handshake) {
    console.log('[Synthetic] Handshake not found:', handshakeId)
    return { autoAccepted: false }
  }

  // Determine which partnership is the receiver (hasn't consented yet)
  const receiverPartnershipId = handshake.a_consent
    ? handshake.b_partnership  // A sent it, B receives
    : handshake.a_partnership  // B sent it, A receives

  // Check if receiver is a synthetic partnership
  if (!isSyntheticPartnership(receiverPartnershipId)) {
    return { autoAccepted: false }
  }

  // Auto-accept: set both consents to true and mark as matched
  const { error: updateError } = await adminClient
    .from('handshakes')
    .update({
      a_consent: true,
      b_consent: true,
      state: 'matched',
      matched_at: new Date().toISOString()
    })
    .eq('id', handshakeId)

  if (updateError) {
    console.error('[Synthetic] Auto-accept failed:', updateError)
    return { autoAccepted: false }
  }

  console.log('[Synthetic] Auto-accepted handshake:', handshakeId)
  return { autoAccepted: true }
}
