import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/partnerships/my-partnership
 *
 * Purpose: Get current user's partnership membership data
 *
 * Returns: {
 *   partnershipId: string,
 *   role: string,
 *   joinedAt: string,
 *   surveyReviewed: boolean
 * }
 *
 * Security: Requires valid session (authenticated user only)
 *
 * This replaces client-side calls to:
 * supabase.from('partnership_members').select('*').eq('user_id', userId)
 */
export async function GET(request: Request) {
  try {
    console.log('[API /my-partnership] Getting user partnership data')

    // Create server client (uses SSR cookies)
    const supabase = await createClient()

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      console.error('[API /my-partnership] No session found:', sessionError?.message)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[API /my-partnership] User ID:', session.user.id)

    // Query partnership_members with server client
    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id, role, joined_at, survey_reviewed')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('[API /my-partnership] Query error:', membershipError)
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 }
      )
    }

    if (!membership) {
      console.log('[API /my-partnership] No partnership found for user')
      return NextResponse.json(
        { partnership: null },
        { status: 200 }
      )
    }

    console.log('[API /my-partnership] Found partnership:', membership.partnership_id)

    return NextResponse.json({
      partnership: {
        partnershipId: membership.partnership_id,
        role: membership.role,
        joinedAt: membership.joined_at,
        surveyReviewed: membership.survey_reviewed
      }
    })

  } catch (error) {
    console.error('[API /my-partnership] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch partnership data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
