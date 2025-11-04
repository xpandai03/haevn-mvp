import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/partnerships/debug-info
 *
 * Purpose: Get detailed partnership membership info for debugging
 * Used by: app/debug-auth/page.tsx
 *
 * Returns: {
 *   members: Array<partnership_member>,
 *   count: number
 * }
 *
 * Security: Requires valid session
 */
export async function GET(request: Request) {
  try {
    console.log('[API /debug-info] Getting partnership debug data')

    const supabase = await createClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all partnership_members data for this user
    const { data: members, error: membersError } = await supabase
      .from('partnership_members')
      .select('*')
      .eq('user_id', session.user.id)

    if (membersError) {
      console.error('[API /debug-info] Query error:', membersError)
      return NextResponse.json(
        { error: membersError.message, errorCode: membersError.code },
        { status: 500 }
      )
    }

    console.log('[API /debug-info] Found', members?.length || 0, 'memberships')

    return NextResponse.json({
      members: members || [],
      count: members?.length || 0
    })

  } catch (error) {
    console.error('[API /debug-info] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch debug info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
