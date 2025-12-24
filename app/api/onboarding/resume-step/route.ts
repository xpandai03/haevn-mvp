import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerOnboardingFlowController } from '@/lib/onboarding/flow'

/**
 * GET /api/onboarding/resume-step
 *
 * Purpose: Determine where an authenticated user should resume their onboarding flow
 *
 * Returns:
 * - { status: "complete", resumePath: null } if onboarding is done
 * - { status: "incomplete", resumePath: "/onboarding/..." } if onboarding needed
 *
 * Security: Requires valid user (uses getUser() for verified identity)
 */
export async function GET(request: Request) {
  try {
    console.log('[API /resume-step] ===== GET RESUME STEP =====')

    // Create server client (uses SSR cookies)
    const supabase = await createClient()

    // CRITICAL: Use getUser() not getSession() for verified identity
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[API /resume-step] No verified user:', userError?.message)
      return NextResponse.json(
        { error: 'Unauthorized', status: 'error', resumePath: '/auth/login' },
        { status: 401 }
      )
    }

    console.log('[API /resume-step] Verified User ID:', user.id)
    console.log('[API /resume-step] Verified User email:', user.email)

    // TEMPORARY DIAGNOSTIC BYPASS - remove after debugging
    // Forces complete status for specific test user to verify deploy works
    if (user.email === 'raunek@cloudsteer.com') {
      console.log('[API /resume-step] 🔴 DIAGNOSTIC BYPASS for raunek@cloudsteer.com')
      console.log('[API /resume-step] Forcing complete status to verify deploy')
      return NextResponse.json({
        status: 'complete',
        resumePath: null,
        userId: user.id,
        timestamp: new Date().toISOString(),
        _debug: 'FORCED_COMPLETE_FOR_DIAGNOSTIC'
      })
    }

    // SHORT-CIRCUIT: Check onboarding completion BEFORE calling getResumeStep
    // Use the SAME logic as middleware
    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id, survey_reviewed, role')
      .eq('user_id', user.id)
      .maybeSingle()

    // DIAGNOSTIC: Log membership state BEFORE any checks
    console.log('[API /resume-step] 🔍 MEMBERSHIP DIAGNOSTIC:', {
      hasMembership: !!membership,
      membershipError: membershipError?.message || null,
      partnershipId: membership?.partnership_id || 'NULL',
      role: membership?.role || 'NULL',
      surveyReviewed: membership?.survey_reviewed ?? 'NULL'
    })

    // Also fetch survey data regardless of membership for diagnostics
    const { data: surveyData, error: surveyError } = await supabase
      .from('user_survey_responses')
      .select('completion_pct')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('[API /resume-step] 🔍 SURVEY DIAGNOSTIC:', {
      hasSurveyData: !!surveyData,
      surveyError: surveyError?.message || null,
      completionPct: surveyData?.completion_pct ?? 'NULL'
    })

    // Now do the completion check
    if (membership?.partnership_id && surveyData) {
      // SAME completion logic as middleware
      const isComplete = surveyData.completion_pct === 100 &&
        (membership.role === 'owner' || membership.survey_reviewed === true)

      console.log('[API /resume-step] Completion check:', {
        completionPct: surveyData.completion_pct,
        role: membership.role,
        surveyReviewed: membership.survey_reviewed,
        isComplete
      })

      if (isComplete) {
        console.log('[API /resume-step] ✅ Onboarding COMPLETE - returning early')
        console.log('[API /resume-step] =====================================')
        return NextResponse.json({
          status: 'complete',
          resumePath: null,
          userId: user.id,
          timestamp: new Date().toISOString()
        })
      }
    } else {
      console.log('[API /resume-step] ⚠️ SKIPPING completion check - missing data:', {
        hasMembership: !!membership,
        hasPartnershipId: !!membership?.partnership_id,
        hasSurveyData: !!surveyData
      })
    }

    // Only call getResumeStep if onboarding is NOT complete
    console.log('[API /resume-step] Onboarding incomplete, calling getResumeStep()')
    const flowController = await getServerOnboardingFlowController()
    const resumePath = await flowController.getResumeStep(user.id)

    // null means complete (shouldn't happen here, but handle it)
    const finalPath = resumePath ?? '/dashboard'

    console.log('[API /resume-step] getResumeStep returned:', resumePath)
    console.log('[API /resume-step] Final path:', finalPath)
    console.log('[API /resume-step] =====================================')

    return NextResponse.json({
      status: 'incomplete',
      resumePath: finalPath,
      userId: user.id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[API /resume-step] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to determine resume path',
        status: 'error',
        resumePath: '/dashboard', // Safe fallback
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
