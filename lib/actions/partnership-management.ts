'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Partnership Management Actions
 * Handles multi-partner operations: fetching members, creating invites, managing partnerships
 */

// ============================================
// TYPES
// ============================================

export interface PartnershipMember {
  user_id: string
  email: string
  full_name: string
  role: 'owner' | 'member'
  joined_at: string
  survey_reviewed: boolean
  survey_reviewed_at: string | null
}

export interface PendingInvite {
  id: string
  invite_code: string
  to_email: string
  created_at: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
}

export interface PartnershipInfo {
  id: string
  tier: 'free' | 'premium'
  created_at: string
  owner_id: string
  members: PartnershipMember[]
  pending_invites: PendingInvite[]
  survey_completion: number
  all_partners_reviewed: boolean
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get current user's partnership ID
 */
async function getCurrentPartnershipId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const adminClient = await createAdminClient()
  const { data: memberships } = await adminClient
    .from('partnership_members')
    .select('partnership_id, role')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) return null

  // Prioritize owner role, fallback to first membership
  const primaryMembership = memberships.find(m => m.role === 'owner') || memberships[0]
  return primaryMembership.partnership_id
}

// ============================================
// PARTNERSHIP MEMBER QUERIES
// ============================================

/**
 * Get all members of current user's partnership
 */
export async function getPartnershipMembers(): Promise<{
  success: boolean
  members?: PartnershipMember[]
  error?: string
}> {
  try {
    const partnershipId = await getCurrentPartnershipId()
    if (!partnershipId) {
      return { success: false, error: 'No partnership found' }
    }

    const adminClient = await createAdminClient()

    // Fetch all partnership members with user details
    const { data: members, error } = await adminClient
      .from('partnership_members')
      .select(`
        user_id,
        role,
        joined_at,
        survey_reviewed,
        survey_reviewed_at,
        profiles (
          email,
          full_name
        )
      `)
      .eq('partnership_id', partnershipId)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('[Partnership Management] Error fetching members:', error)
      return { success: false, error: error.message }
    }

    // Transform to clean structure
    const formattedMembers: PartnershipMember[] = members.map((m: any) => ({
      user_id: m.user_id,
      email: m.profiles?.email || 'Unknown',
      full_name: m.profiles?.full_name || 'Unknown',
      role: m.role,
      joined_at: m.joined_at,
      survey_reviewed: m.survey_reviewed,
      survey_reviewed_at: m.survey_reviewed_at
    }))

    return { success: true, members: formattedMembers }
  } catch (err: any) {
    console.error('[Partnership Management] Error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Get comprehensive partnership info (members + invites + survey status)
 */
export async function getPartnershipInfo(): Promise<{
  success: boolean
  partnership?: PartnershipInfo
  error?: string
}> {
  try {
    const partnershipId = await getCurrentPartnershipId()
    if (!partnershipId) {
      return { success: false, error: 'No partnership found' }
    }

    const adminClient = await createAdminClient()

    // Fetch partnership details
    const { data: partnership, error: partnershipError } = await adminClient
      .from('partnerships')
      .select('id, tier, created_at, owner_id')
      .eq('id', partnershipId)
      .single()

    if (partnershipError) {
      return { success: false, error: partnershipError.message }
    }

    // Fetch members
    const membersResult = await getPartnershipMembers()
    if (!membersResult.success) {
      return { success: false, error: membersResult.error }
    }

    // Fetch pending invites
    const { data: invites } = await adminClient
      .from('partnership_requests')
      .select('id, invite_code, to_email, created_at, status')
      .eq('partnership_id', partnershipId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // Fetch survey completion
    const { data: survey } = await adminClient
      .from('user_survey_responses')
      .select('completion_pct')
      .eq('partnership_id', partnershipId)
      .single()

    // Check if all partners have reviewed
    const allReviewed = membersResult.members?.every(m => m.survey_reviewed) || false

    const partnershipInfo: PartnershipInfo = {
      id: partnership.id,
      tier: partnership.tier,
      created_at: partnership.created_at,
      owner_id: partnership.owner_id,
      members: membersResult.members || [],
      pending_invites: invites || [],
      survey_completion: survey?.completion_pct || 0,
      all_partners_reviewed: allReviewed
    }

    return { success: true, partnership: partnershipInfo }
  } catch (err: any) {
    console.error('[Partnership Management] Error:', err)
    return { success: false, error: err.message }
  }
}

// ============================================
// INVITE GENERATION
// ============================================

/**
 * Generate a new partnership invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude ambiguous chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create a new partnership invite
 */
export async function createPartnershipInvite(toEmail: string): Promise<{
  success: boolean
  inviteCode?: string
  inviteUrl?: string
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toEmail)) {
      return { success: false, error: 'Invalid email format' }
    }

    const partnershipId = await getCurrentPartnershipId()
    if (!partnershipId) {
      return { success: false, error: 'No partnership found' }
    }

    const adminClient = await createAdminClient()

    // Check if email is already in partnership
    const { data: existingMember } = await adminClient
      .from('partnership_members')
      .select('user_id, profiles(email)')
      .eq('partnership_id', partnershipId)

    const memberEmails = existingMember?.map((m: any) => m.profiles?.email.toLowerCase()) || []
    if (memberEmails.includes(toEmail.toLowerCase())) {
      return { success: false, error: 'This email is already a member of your partnership' }
    }

    // Check for existing pending invite to this email
    const { data: existingInvite } = await adminClient
      .from('partnership_requests')
      .select('id, invite_code')
      .eq('partnership_id', partnershipId)
      .eq('to_email', toEmail.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) {
      // Return existing invite code
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const inviteUrl = `${baseUrl}/auth/signup?invite=${existingInvite.invite_code}`
      return {
        success: true,
        inviteCode: existingInvite.invite_code,
        inviteUrl
      }
    }

    // Generate new invite code
    let inviteCode = generateInviteCode()
    let attempts = 0
    const maxAttempts = 10

    // Ensure uniqueness
    while (attempts < maxAttempts) {
      const { data: existing } = await adminClient
        .from('partnership_requests')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle()

      if (!existing) break
      inviteCode = generateInviteCode()
      attempts++
    }

    if (attempts >= maxAttempts) {
      return { success: false, error: 'Failed to generate unique invite code' }
    }

    // Create invite
    const { error: insertError } = await adminClient
      .from('partnership_requests')
      .insert({
        from_user_id: user.id,
        to_email: toEmail.toLowerCase(),
        partnership_id: partnershipId,
        invite_code: inviteCode,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('[Partnership Management] Error creating invite:', insertError)
      return { success: false, error: insertError.message }
    }

    // Generate full invite URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/auth/signup?invite=${inviteCode}`

    console.log('[Partnership Management] ✅ Invite created:', inviteCode)
    return { success: true, inviteCode, inviteUrl }
  } catch (err: any) {
    console.error('[Partnership Management] Error:', err)
    return { success: false, error: err.message }
  }
}

// ============================================
// INVITE MANAGEMENT
// ============================================

/**
 * Cancel a pending invite
 */
export async function cancelPartnershipInvite(inviteId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const partnershipId = await getCurrentPartnershipId()
    if (!partnershipId) {
      return { success: false, error: 'No partnership found' }
    }

    const adminClient = await createAdminClient()

    // Update invite status to expired
    const { error } = await adminClient
      .from('partnership_requests')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('id', inviteId)
      .eq('partnership_id', partnershipId)
      .eq('status', 'pending')

    if (error) {
      console.error('[Partnership Management] Error canceling invite:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[Partnership Management] Error:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Get pending invites for current partnership
 */
export async function getPendingInvites(): Promise<{
  success: boolean
  invites?: PendingInvite[]
  error?: string
}> {
  try {
    const partnershipId = await getCurrentPartnershipId()
    if (!partnershipId) {
      return { success: false, error: 'No partnership found' }
    }

    const adminClient = await createAdminClient()

    const { data: invites, error } = await adminClient
      .from('partnership_requests')
      .select('id, invite_code, to_email, created_at, status')
      .eq('partnership_id', partnershipId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Partnership Management] Error fetching invites:', error)
      return { success: false, error: error.message }
    }

    return { success: true, invites: invites || [] }
  } catch (err: any) {
    console.error('[Partnership Management] Error:', err)
    return { success: false, error: err.message }
  }
}
