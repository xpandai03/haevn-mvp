import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'

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
 * Uses admin client to bypass RLS (same pattern as Dashboard)
 */
export async function GET(request: Request) {
  try {
    console.log('[API /my-partnership] Getting user partnership data')

    // Create server client for authentication
    const supabase = await createClient()

    // Get current user (validates with Supabase Auth server, not cached)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[API /my-partnership] No user found:', userError?.message)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[API /my-partnership] User ID:', user.id)

    // Use admin client with canonical selectBestPartnership (same as Dashboard)
    const adminClient = await createAdminClient()
    const membership = await selectBestPartnership(adminClient, user.id)

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
