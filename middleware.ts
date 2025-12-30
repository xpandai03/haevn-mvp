import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// DEBUG: Build ID for verifying deploy - remove after debugging
const BUILD_ID = 'multi-partnership-fix'

/**
 * ACTIVE PARTNERSHIP RULE (inline for edge runtime):
 * 1. LIVE partnerships first (profile_state = 'live')
 * 2. Then by updated_at DESC (most recently updated)
 * 3. Never return a draft if a live exists
 */
async function selectBestPartnership(
  supabase: any,
  userId: string
): Promise<{ partnership_id: string; role: string; survey_reviewed: boolean; profile_state: string } | null> {
  const { data: memberships, error } = await supabase
    .from('partnership_members')
    .select(`
      partnership_id,
      role,
      survey_reviewed,
      joined_at,
      partnerships!inner (
        membership_tier,
        profile_state,
        updated_at
      )
    `)
    .eq('user_id', userId)

  if (error || !memberships || memberships.length === 0) {
    return null
  }

  // Sort: LIVE first, then by updated_at DESC
  const sortedMemberships = [...memberships].sort((a: any, b: any) => {
    const stateA = a.partnerships?.profile_state || 'draft'
    const stateB = b.partnerships?.profile_state || 'draft'

    // LIVE partnerships come first
    if (stateA === 'live' && stateB !== 'live') return -1
    if (stateB === 'live' && stateA !== 'live') return 1

    // Within same state, sort by updated_at DESC
    const updatedA = new Date(a.partnerships?.updated_at || 0).getTime()
    const updatedB = new Date(b.partnerships?.updated_at || 0).getTime()
    return updatedB - updatedA
  })

  const best = sortedMemberships[0]
  const profileState = best.partnerships?.profile_state || 'draft'

  // Instrumentation log
  console.log('[ACTIVE_PARTNERSHIP_SELECTED]', {
    userId,
    partnershipId: best.partnership_id,
    profile_state: profileState,
    totalPartnerships: memberships.length
  })

  return {
    partnership_id: best.partnership_id,
    role: best.role,
    survey_reviewed: best.survey_reviewed || false,
    profile_state: profileState
  }
}

type RedirectReason =
  | 'NO_SESSION'
  | 'NO_PARTNERSHIP'
  | 'INVALID_PARTNERSHIP_ID'
  | 'NO_SURVEY_ROW'
  | 'SURVEY_ERROR'
  | 'INCOMPLETE_SURVEY'
  | 'NOT_REVIEWED_MEMBER'
  | 'RESUME_STEP_REDIRECT'
  | 'COMPLETE_ALLOW'
  | 'RESUME_STEP_NULL_ALLOW'
  | 'ONBOARDING_ROUTE_ALLOW'
  | 'ONBOARDING_ROUTE_COMPLETE_REDIRECT'

function logOnboardingGate(data: {
  email?: string
  userId?: string
  partnershipId?: string | null
  completionPct?: number | null
  role?: string | null
  surveyReviewed?: boolean | null
  isComplete?: boolean
  redirectTo?: string | null
  reason: RedirectReason
  decision: 'allow' | 'redirect'
}) {
  console.log(`[ONBOARDING_GATE] build=${BUILD_ID} email=${data.email || 'N/A'} user_id=${data.userId || 'N/A'} partnership_id=${data.partnershipId || 'N/A'} completion_pct=${data.completionPct ?? 'N/A'} role=${data.role || 'N/A'} survey_reviewed=${data.surveyReviewed ?? 'N/A'} isComplete=${data.isComplete ?? 'N/A'} redirect_to=${data.redirectTo || 'N/A'} reason=${data.reason} decision=${data.decision}`)
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  // Create a Supabase client configured to use cookies
  // IMPORTANT: This must run for ALL requests, including API routes, to properly set up cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/signup',
    '/auth/signup/step-1',
    '/auth/signup/step-2',
    '/auth/signup/step-3',
    '/auth/login',
    '/auth/callback'
  ]
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith('/auth/'))

  // API routes and onboarding routes - allow through but cookies are set up above
  const isApiRoute = pathname.startsWith('/api/')
  const isOnboardingRoute = pathname.startsWith('/onboarding/')

  // Skip auth check for public routes and API routes
  // API routes will handle their own auth checks
  if (isPublicRoute || isApiRoute) {
    return response
  }

  // IMPORTANT: For onboarding routes, check if user has COMPLETED onboarding
  // If they have, redirect them to dashboard (prevent access to onboarding when done)
  if (isOnboardingRoute) {
    // CRITICAL: Use getUser() not getSession() - getUser() validates with Supabase auth server
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.log('[TRACE-MW] getUser() error on onboarding route:', userError.message)
    }

    if (user) {
      // PHASE 2: Test user short-circuit
      const testUserEmail = process.env.TEST_USER_EMAIL
      if (testUserEmail && user.email === testUserEmail) {
        console.log('[TRACE-MW] 🔴 TEST USER SHORT-CIRCUIT ACTIVE')
        console.log('[TRACE-MW] Bypassing normal onboarding flow for:', user.email)
        console.log('[TRACE-MW] Redirecting to /dashboard')
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      console.log('[TRACE-MW] ===== ONBOARDING ROUTE CHECK (getUser) =====')
      console.log('[TRACE-MW] Verified user accessing onboarding:', user.email)
      console.log('[TRACE-MW] User ID:', user.id)
      console.log('[TRACE-MW] Route:', pathname)

      // Check if user has completed onboarding (partnership + survey + reviewed)
      // Use deterministic selection for users with multiple partnerships
      const membership = await selectBestPartnership(supabase, user.id)

      if (membership?.partnership_id) {
        // DEFENSIVE GUARD: Validate partnership_id before querying
        const partnershipId = membership.partnership_id
        if (!partnershipId || typeof partnershipId !== 'string' || partnershipId.length < 10) {
          console.warn('[TRACE-MW] ⚠️ Invalid partnershipId in onboarding check:', partnershipId)
          console.log('[TRACE-MW] Allowing access to onboarding to fix data')
        } else {
          console.log('[TRACE-MW] ✅ Querying survey by user_id:', user.id)
          const { data: surveyData, error: surveyError } = await supabase
            .from('user_survey_responses')
            .select('completion_pct')
            .eq('user_id', user.id)
            .maybeSingle()

          if (surveyError) {
            console.error('[TRACE-MW] ❌ Error fetching survey in onboarding check:', surveyError.message)
          }

          const isComplete = surveyData?.completion_pct === 100 &&
            (membership.role === 'owner' || membership.survey_reviewed === true)

          console.log('[TRACE-MW] Onboarding completion check:', {
            hasPartnership: !!membership,
            completionPct: surveyData?.completion_pct,
            role: membership.role,
            reviewed: membership.survey_reviewed,
            isComplete,
            error: surveyError?.message
          })

          if (isComplete) {
            // User has completed onboarding, redirect to dashboard
            logOnboardingGate({
              email: user.email,
              userId: user.id,
              partnershipId: partnershipId,
              completionPct: surveyData?.completion_pct,
              role: membership.role,
              surveyReviewed: membership.survey_reviewed,
              isComplete: true,
              redirectTo: '/dashboard',
              reason: 'ONBOARDING_ROUTE_COMPLETE_REDIRECT',
              decision: 'redirect'
            })
            return NextResponse.redirect(new URL('/dashboard', request.url))
          }
        }
      }

      console.log('[TRACE-MW] User still in onboarding, allowing access')
      logOnboardingGate({
        email: user.email,
        userId: user.id,
        partnershipId: membership?.partnership_id,
        completionPct: null,
        role: membership?.role,
        surveyReviewed: membership?.survey_reviewed,
        isComplete: false,
        redirectTo: null,
        reason: 'ONBOARDING_ROUTE_ALLOW',
        decision: 'allow'
      })
    } else {
      console.log('[TRACE-MW] No verified user on onboarding route, allowing access')
    }

    return response
  }

  // Protected routes that require complete onboarding
  const protectedRoutes = ['/dashboard', '/discovery', '/chat', '/connections', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    // CRITICAL: Use getUser() not getSession() - getUser() validates with Supabase auth server
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    console.log('[TRACE-MW] ===== PROTECTED ROUTE CHECK (getUser) =====')
    console.log('[TRACE-MW] Route:', pathname)
    console.log('[TRACE-MW] getUser() result:', { hasUser: !!user, error: userError?.message })

    // TEMPORARY DIAGNOSTIC BYPASS - remove after debugging
    if (user?.email === 'raunek@cloudsteer.com') {
      console.log('[TRACE-MW] 🔴 DIAGNOSTIC BYPASS - allowing raunek@cloudsteer.com to protected route')
      return response
    }

    // If no verified user, redirect to login
    if (!user) {
      console.log('[TRACE-MW] No verified user, redirecting to login')
      logOnboardingGate({
        email: undefined,
        userId: undefined,
        partnershipId: null,
        completionPct: null,
        role: null,
        surveyReviewed: null,
        isComplete: false,
        redirectTo: '/auth/login',
        reason: 'NO_SESSION',
        decision: 'redirect'
      })
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    console.log('[TRACE-MW] Verified User ID:', user.id)
    console.log('[TRACE-MW] Verified User email:', user.email)

    // Check if user has a partnership (use deterministic selection for multiple)
    const membership = await selectBestPartnership(supabase, user.id)

    console.log('[MW] Partnership membership:', {
      hasPartnership: !!membership,
      partnershipId: membership?.partnership_id,
      role: membership?.role,
      surveyReviewed: membership?.survey_reviewed
    })

    if (!membership) {
      // No partnership - redirect to onboarding
      logOnboardingGate({
        email: user.email,
        userId: user.id,
        partnershipId: null,
        completionPct: null,
        role: null,
        surveyReviewed: null,
        isComplete: false,
        redirectTo: '/onboarding/expectations',
        reason: 'NO_PARTNERSHIP',
        decision: 'redirect'
      })
      return NextResponse.redirect(new URL('/onboarding/expectations', request.url))
    }

    // DEFENSIVE GUARD: Validate partnership_id before querying
    const partnershipId = membership.partnership_id
    if (!partnershipId || typeof partnershipId !== 'string' || partnershipId.length < 10) {
      logOnboardingGate({
        email: user.email,
        userId: user.id,
        partnershipId: partnershipId,
        completionPct: null,
        role: membership.role,
        surveyReviewed: membership.survey_reviewed,
        isComplete: false,
        redirectTo: '/onboarding/expectations',
        reason: 'INVALID_PARTNERSHIP_ID',
        decision: 'redirect'
      })
      return NextResponse.redirect(new URL('/onboarding/expectations', request.url))
    }

    console.log('[TRACE-MW] Valid partnershipId:', partnershipId)
    console.log('[TRACE-MW] ✅ Querying survey by user_id:', user.id)

    // Check user's survey completion (stable across partnership changes)
    const { data: surveyData, error: surveyError } = await supabase
      .from('user_survey_responses')
      .select('completion_pct')
      .eq('user_id', user.id)
      .maybeSingle()

    if (surveyError) {
      console.error('[TRACE-MW] ❌ Error fetching survey:', surveyError.message)
      console.error('[TRACE-MW] Code:', surveyError.code)
      console.log('[TRACE-MW] Treating as incomplete, redirecting to onboarding')
    }

    console.log('[TRACE-MW] Partnership survey check:', {
      hasSurveyData: !!surveyData,
      completionPct: surveyData?.completion_pct,
      error: surveyError?.message
    })

    // DATABASE-FIRST PRIORITY: Survey completion is source of truth
    // Owners implicitly reviewed (they created it), members must explicitly review
    const isComplete = surveyData?.completion_pct === 100 &&
      (membership.role === 'owner' || membership.survey_reviewed === true)
    console.log('[TRACE-MW] user=%s pct=%s role=%s reviewed=%s path=%s decision=%s',
      user.email,
      surveyData?.completion_pct,
      membership.survey_reviewed,
      pathname,
      isComplete ? 'ALLOW' : 'REDIRECT'
    )

    // Require survey completion AND user review before accessing protected routes
    if (!isComplete) {
      console.log('[TRACE-MW] ❌ Survey incomplete or not reviewed, calling getResumeStep()')

      // Use flow controller to determine correct redirect
      // Import dynamically to avoid circular dependencies
      const { getServerOnboardingFlowController } = await import('@/lib/onboarding/flow')
      const flowController = await getServerOnboardingFlowController()
      const resumePath = await flowController.getResumeStep(user.id)

      console.log('[TRACE-MW] getResumeStep returned:', resumePath)

      // If resumePath is null, onboarding is complete - allow access
      if (!resumePath) {
        logOnboardingGate({
          email: user.email,
          userId: user.id,
          partnershipId: partnershipId,
          completionPct: surveyData?.completion_pct,
          role: membership.role,
          surveyReviewed: membership.survey_reviewed,
          isComplete: false,
          redirectTo: null,
          reason: 'RESUME_STEP_NULL_ALLOW',
          decision: 'allow'
        })
        // Don't redirect - let user access the protected route
      } else {
        logOnboardingGate({
          email: user.email,
          userId: user.id,
          partnershipId: partnershipId,
          completionPct: surveyData?.completion_pct,
          role: membership.role,
          surveyReviewed: membership.survey_reviewed,
          isComplete: false,
          redirectTo: resumePath,
          reason: 'RESUME_STEP_REDIRECT',
          decision: 'redirect'
        })
        return NextResponse.redirect(new URL(resumePath, request.url))
      }
    } else {
      // isComplete is true - allow access
      logOnboardingGate({
        email: user.email,
        userId: user.id,
        partnershipId: partnershipId,
        completionPct: surveyData?.completion_pct,
        role: membership.role,
        surveyReviewed: membership.survey_reviewed,
        isComplete: true,
        redirectTo: null,
        reason: 'COMPLETE_ALLOW',
        decision: 'allow'
      })
    }

    console.log('[TRACE-MW] ✅ All checks passed, allowing access to', pathname)
    // Allow access to protected routes
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]
}