/**
 * Admin Matching Server Actions
 *
 * Read-only server actions for the Matching Control Center.
 * All queries use admin client to bypass RLS.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'

// Types
export interface PartnershipData {
  id: string
  display_name: string | null
  profile_state: string | null
  membership_tier: string | null
  profile_type: string | null
  city: string | null
  age: number | null
  structure: any
  survey_completion: number
  user_email: string | null
}

export interface ComputedMatchData {
  id: string
  other_partnership_id: string
  other_display_name: string | null
  other_membership_tier: string | null
  score: number
  tier: string
  breakdown: any
  computed_at: string
  social_state: {
    status: 'not_contacted' | 'nudge_sent' | 'nudge_received' | 'pending' | 'connected' | 'free_blocked'
    handshake_id?: string
    nudge_id?: string
  }
}

/**
 * Verify current user has admin access
 */
async function verifyAdminAccess(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user?.email && isAdminUser(user.email)
}

/**
 * Lookup a partnership by email address
 */
export async function lookupPartnershipByEmail(email: string): Promise<{
  partnership: PartnershipData | null
  matches: ComputedMatchData[]
  error?: string
}> {
  // Verify admin access
  if (!await verifyAdminAccess()) {
    return { partnership: null, matches: [], error: 'Unauthorized' }
  }

  const adminClient = await createAdminClient()

  try {
    // Find user by email
    const { data: users, error: userError } = await adminClient
      .from('profiles')
      .select('user_id, email')
      .eq('email', email.toLowerCase())
      .limit(1)

    if (userError || !users || users.length === 0) {
      // Try auth.users table via admin
      const { data: authUsers } = await adminClient.auth.admin.listUsers()
      const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

      if (!authUser) {
        return { partnership: null, matches: [], error: `No user found with email: ${email}` }
      }

      // Get partnership for this user
      const selected = await selectBestPartnership(adminClient, authUser.id)
      if (!selected) {
        return { partnership: null, matches: [], error: `User ${email} has no partnership` }
      }

      return await getPartnershipDetails(selected.partnership_id, email)
    }

    // Get partnership for this user
    const userId = users[0].user_id
    const selected = await selectBestPartnership(adminClient, userId)
    if (!selected) {
      return { partnership: null, matches: [], error: `User ${email} has no partnership` }
    }

    return await getPartnershipDetails(selected.partnership_id, email)
  } catch (err: any) {
    console.error('[lookupPartnershipByEmail] Error:', err)
    return { partnership: null, matches: [], error: err.message || 'Lookup failed' }
  }
}

/**
 * Lookup a partnership by ID
 */
export async function lookupPartnershipById(partnershipId: string): Promise<{
  partnership: PartnershipData | null
  matches: ComputedMatchData[]
  error?: string
}> {
  // Verify admin access
  if (!await verifyAdminAccess()) {
    return { partnership: null, matches: [], error: 'Unauthorized' }
  }

  return await getPartnershipDetails(partnershipId, null)
}

/**
 * Get full partnership details and computed matches
 */
async function getPartnershipDetails(partnershipId: string, userEmail: string | null): Promise<{
  partnership: PartnershipData | null
  matches: ComputedMatchData[]
  error?: string
}> {
  const adminClient = await createAdminClient()

  try {
    // Get partnership data
    const { data: partnership, error: pError } = await adminClient
      .from('partnerships')
      .select('id, display_name, profile_state, membership_tier, profile_type, city, age, structure')
      .eq('id', partnershipId)
      .single()

    if (pError || !partnership) {
      return { partnership: null, matches: [], error: `Partnership not found: ${partnershipId}` }
    }

    // Get survey completion for this partnership's owner
    const { data: members } = await adminClient
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)
      .eq('role', 'owner')
      .limit(1)

    let surveyCompletion = 0
    let ownerEmail = userEmail
    if (members && members.length > 0) {
      const { data: survey } = await adminClient
        .from('user_survey_responses')
        .select('completion_pct')
        .eq('user_id', members[0].user_id)
        .single()
      surveyCompletion = survey?.completion_pct || 0

      // Get owner email if not provided
      if (!ownerEmail) {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('email')
          .eq('user_id', members[0].user_id)
          .single()
        ownerEmail = profile?.email || null
      }
    }

    const partnershipData: PartnershipData = {
      id: partnership.id,
      display_name: partnership.display_name,
      profile_state: partnership.profile_state,
      membership_tier: partnership.membership_tier,
      profile_type: partnership.profile_type,
      city: partnership.city,
      age: partnership.age,
      structure: partnership.structure,
      survey_completion: surveyCompletion,
      user_email: ownerEmail,
    }

    // Get computed matches
    const matches = await getComputedMatches(adminClient, partnershipId)

    return { partnership: partnershipData, matches }
  } catch (err: any) {
    console.error('[getPartnershipDetails] Error:', err)
    return { partnership: null, matches: [], error: err.message || 'Failed to get partnership details' }
  }
}

/**
 * Get computed matches for a partnership with social state
 */
async function getComputedMatches(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  partnershipId: string
): Promise<ComputedMatchData[]> {
  // Query computed_matches bidirectionally
  const { data: matches, error } = await adminClient
    .from('computed_matches')
    .select('id, partnership_a, partnership_b, score, tier, breakdown, computed_at')
    .or(`partnership_a.eq.${partnershipId},partnership_b.eq.${partnershipId}`)
    .order('score', { ascending: false })

  if (error || !matches) {
    console.error('[getComputedMatches] Error:', error)
    return []
  }

  // Get other partnership IDs
  const otherIds = matches.map(m =>
    m.partnership_a === partnershipId ? m.partnership_b : m.partnership_a
  )

  if (otherIds.length === 0) {
    return []
  }

  // Get partnership display names and tiers
  const { data: partnerships } = await adminClient
    .from('partnerships')
    .select('id, display_name, membership_tier')
    .in('id', otherIds)

  const partnershipMap = new Map(
    partnerships?.map(p => [p.id, { display_name: p.display_name, membership_tier: p.membership_tier }]) || []
  )

  // Get social state for each match
  const matchesWithState = await Promise.all(
    matches.map(async (match) => {
      const otherId = match.partnership_a === partnershipId ? match.partnership_b : match.partnership_a
      const otherInfo = partnershipMap.get(otherId)
      const socialState = await getSocialState(adminClient, partnershipId, otherId)

      return {
        id: match.id,
        other_partnership_id: otherId,
        other_display_name: otherInfo?.display_name || null,
        other_membership_tier: otherInfo?.membership_tier || null,
        score: match.score,
        tier: match.tier,
        breakdown: match.breakdown,
        computed_at: match.computed_at,
        social_state: socialState,
      }
    })
  )

  return matchesWithState
}

/**
 * Get social state between two partnerships
 */
async function getSocialState(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  partnershipA: string,
  partnershipB: string
): Promise<ComputedMatchData['social_state']> {
  // Check for handshake
  const { data: handshake } = await adminClient
    .from('handshakes')
    .select('id, state, a_consent, b_consent, a_partnership, b_partnership')
    .or(`and(a_partnership.eq.${partnershipA},b_partnership.eq.${partnershipB}),and(a_partnership.eq.${partnershipB},b_partnership.eq.${partnershipA})`)
    .limit(1)
    .maybeSingle()

  if (handshake) {
    if (handshake.state === 'matched' && handshake.a_consent && handshake.b_consent) {
      return { status: 'connected', handshake_id: handshake.id }
    }
    return { status: 'pending', handshake_id: handshake.id }
  }

  // Check for nudges - need to get user IDs for partnerships
  const { data: membersA } = await adminClient
    .from('partnership_members')
    .select('user_id')
    .eq('partnership_id', partnershipA)

  const { data: membersB } = await adminClient
    .from('partnership_members')
    .select('user_id')
    .eq('partnership_id', partnershipB)

  if (membersA && membersB && membersA.length > 0 && membersB.length > 0) {
    const userIdsA = membersA.map(m => m.user_id)
    const userIdsB = membersB.map(m => m.user_id)

    // Check nudge from A to B
    const { data: nudgeSent } = await adminClient
      .from('nudges')
      .select('id')
      .in('sender_id', userIdsA)
      .in('recipient_id', userIdsB)
      .limit(1)
      .maybeSingle()

    if (nudgeSent) {
      return { status: 'nudge_sent', nudge_id: nudgeSent.id }
    }

    // Check nudge from B to A
    const { data: nudgeReceived } = await adminClient
      .from('nudges')
      .select('id')
      .in('sender_id', userIdsB)
      .in('recipient_id', userIdsA)
      .limit(1)
      .maybeSingle()

    if (nudgeReceived) {
      return { status: 'nudge_received', nudge_id: nudgeReceived.id }
    }
  }

  // Check if other partnership is free (blocked for connection)
  const { data: otherPartnership } = await adminClient
    .from('partnerships')
    .select('membership_tier')
    .eq('id', partnershipB)
    .single()

  if (otherPartnership?.membership_tier === 'free') {
    return { status: 'free_blocked' }
  }

  return { status: 'not_contacted' }
}
