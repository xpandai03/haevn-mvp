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

// Temporary GET handler to verify deployment build version (no auth required)
export async function GET() {
  return NextResponse.json({
    build: '2026-03-30T2',
    commit: 'b32dcce+GET',
    route: 'app/api/admin/recompute-matches/route.ts',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  console.log(`🔥 ACTIVE RECOMPUTE PATH — route.ts BUILD=2026-03-30T1`)
  try {
    // Verify admin access
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email || !isAdminUser(user.email)) {
      console.log(`🔥 RECOMPUTE DENIED — not admin: ${user?.email}`)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    console.log(`🔥 RECOMPUTE AUTHORIZED — admin=${user.email}, calling recomputeAllMatches()`)

    // Trigger recomputation (this may take a while)
    const result = await recomputeAllMatches()

    return NextResponse.json({
      success: true,
      result: {
        total: result.total,
        computed: result.computed,
        errors: result.errors,
        details: result.details, // Full per-partnership breakdown
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
