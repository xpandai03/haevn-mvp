import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerOnboardingFlowController } from '@/lib/onboarding/flow'

/**
 * GET /api/onboarding/resume-step
 *
 * Purpose: Determine where an authenticated user should resume their onboarding flow
 *
 * This replaces client-side calls to OnboardingFlowController.getResumeStep()
 * which were causing 400 errors due to RLS policies when using browser client.
 *
 * Returns: { resumePath: string }
 * Example: { resumePath: "/dashboard" } or { resumePath: "/onboarding/survey" }
 *
 * Security: Requires valid session (authenticated user only)
 */
export async function GET(request: Request) {
  try {
    console.log('[API /resume-step] ===== GET RESUME STEP =====')

    // Create server client (uses SSR cookies)
    const supabase = await createClient()

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      console.error('[API /resume-step] No session found:', sessionError?.message)
      return NextResponse.json(
        { error: 'Unauthorized', resumePath: '/auth/login' },
        { status: 401 }
      )
    }

    console.log('[API /resume-step] User ID:', session.user.id)
    console.log('[API /resume-step] User email:', session.user.email)

    // Use server flow controller (with server Supabase client)
    const flowController = await getServerOnboardingFlowController()

    // Get resume path - this executes server-side with proper client
    const resumePath = await flowController.getResumeStep(session.user.id)

    // null means onboarding is complete - map to /dashboard
    const finalPath = resumePath ?? '/dashboard'

    console.log('[API /resume-step] Resume path determined:', resumePath)
    console.log('[API /resume-step] Final path (null → /dashboard):', finalPath)
    console.log('[API /resume-step] =====================================')

    return NextResponse.json({
      resumePath: finalPath,
      userId: session.user.id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[API /resume-step] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to determine resume path',
        resumePath: '/dashboard', // Safe fallback
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
