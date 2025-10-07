'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Generate a unique 6-character invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Remove ambiguous chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create a partnership invitation
 */
export async function createPartnershipInvite(partnerEmail: string): Promise<{
  success: boolean
  inviteCode?: string
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user's partnership
    const adminClient = createAdminClient()
    const { data: memberships, error: membershipError } = await adminClient
      .from('partnership_members')
      .select('partnership_id, role')
      .eq('user_id', user.id)
      .limit(1)

    if (membershipError || !memberships || memberships.length === 0) {
      return { success: false, error: 'No partnership found. Create a partnership first.' }
    }

    const partnershipId = memberships[0].partnership_id

    // Check if user already has a pending invite to this email
    const { data: existingInvite } = await adminClient
      .from('partnership_requests')
      .select('id, status')
      .eq('partnership_id', partnershipId)
      .eq('to_email', partnerEmail.toLowerCase())
      .eq('status', 'pending')
      .limit(1)
      .single()

    if (existingInvite) {
      return { success: false, error: 'Invitation already sent to this email' }
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode()
    let codeExists = true
    let attempts = 0

    while (codeExists && attempts < 10) {
      const { data: existing } = await adminClient
        .from('partnership_requests')
        .select('id')
        .eq('invite_code', inviteCode)
        .limit(1)
        .single()

      if (!existing) {
        codeExists = false
      } else {
        inviteCode = generateInviteCode()
        attempts++
      }
    }

    if (codeExists) {
      return { success: false, error: 'Failed to generate unique invite code' }
    }

    // Create the invite
    const { error: insertError } = await adminClient
      .from('partnership_requests')
      .insert({
        from_user_id: user.id,
        to_email: partnerEmail.toLowerCase(),
        partnership_id: partnershipId,
        invite_code: inviteCode,
        status: 'pending'
      })

    if (insertError) {
      console.error('Error creating invite:', insertError)
      return { success: false, error: 'Failed to create invitation' }
    }

    return { success: true, inviteCode }
  } catch (error) {
    console.error('Error in createPartnershipInvite:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Accept a partnership invitation
 */
export async function acceptPartnershipInvite(inviteCode: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || !user.email) {
      return { success: false, error: 'Not authenticated' }
    }

    const adminClient = createAdminClient()

    // Find the invite
    const { data: invite, error: inviteError } = await adminClient
      .from('partnership_requests')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .eq('to_email', user.email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (inviteError || !invite) {
      return { success: false, error: 'Invalid or expired invite code' }
    }

    // Check if user is already in a partnership
    const { data: existingMembership } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (existingMembership) {
      return { success: false, error: 'You are already in a partnership' }
    }

    // Add user to the partnership
    const { error: memberError } = await adminClient
      .from('partnership_members')
      .insert({
        partnership_id: invite.partnership_id,
        user_id: user.id,
        role: 'member'
      })

    if (memberError) {
      console.error('Error adding member:', memberError)
      return { success: false, error: 'Failed to join partnership' }
    }

    // Update invite status
    const { error: updateError } = await adminClient
      .from('partnership_requests')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    if (updateError) {
      console.error('Error updating invite status:', updateError)
    }

    return { success: true }
  } catch (error) {
    console.error('Error in acceptPartnershipInvite:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get pending invites for current user
 */
export async function getPendingInvites(): Promise<{
  sent: Array<{ id: string; to_email: string; invite_code: string; created_at: string }>
  received: Array<{ id: string; from_email: string; invite_code: string; created_at: string }>
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || !user.email) {
      return { sent: [], received: [] }
    }

    const adminClient = createAdminClient()

    // Get invites sent by user
    const { data: sent } = await adminClient
      .from('partnership_requests')
      .select('id, to_email, invite_code, created_at')
      .eq('from_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // Get invites received by user
    const { data: received } = await adminClient
      .from('partnership_requests')
      .select(`
        id,
        invite_code,
        created_at,
        from_user:auth.users!partnership_requests_from_user_id_fkey(email)
      `)
      .eq('to_email', user.email.toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return {
      sent: sent || [],
      received: (received || []).map((r: any) => ({
        id: r.id,
        from_email: r.from_user?.email || 'Unknown',
        invite_code: r.invite_code,
        created_at: r.created_at
      }))
    }
  } catch (error) {
    console.error('Error in getPendingInvites:', error)
    return { sent: [], received: [] }
  }
}
