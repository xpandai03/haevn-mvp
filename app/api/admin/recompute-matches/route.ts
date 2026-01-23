/**
 * Admin API Route: Recompute All Matches
 * 
 * Admin-only endpoint to trigger recomputation of all matches.
 * Useful for backfilling existing users or refreshing match data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'
import { recomputeAllMatches } from '@/lib/services/computeMatches'

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email || !isAdminUser(user.email)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    console.log(`[API /admin/recompute-matches] Admin ${user.email} triggered recompute`)

    // Trigger recomputation (this may take a while)
    const result = await recomputeAllMatches()

    return NextResponse.json({
      success: true,
      result: {
        total: result.total,
        computed: result.computed,
        errors: result.errors,
        details: result.details.slice(0, 10), // Return first 10 for preview
      },
    })
  } catch (error: any) {
    console.error('[API /admin/recompute-matches] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to recompute matches',
      },
      { status: 500 }
    )
  }
}
