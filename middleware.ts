import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// DEBUG: Build ID for verifying deploy - remove after debugging
const BUILD_ID = 'ef9c026-debug'

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
    // Get session to check completion status
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      // PHASE 2: Test user short-circuit
      const testUserEmail = process.env.TEST_USER_EMAIL
      if (testUserEmail && session.user.email === testUserEmail) {
        console.log('[TRACE-MW] 🔴 TEST USER SHORT-CIRCUIT ACTIVE')
        console.log('[TRACE-MW] Bypassing normal onboarding flow for:', session.user.email)
        console.log('[TRACE-MW] Redirecting to /dashboard')
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      console.log('[TRACE-MW] ===== ONBOARDING ROUTE CHECK =====')
      console.log('[TRACE-MW] User accessing onboarding:', session.user.email)
      console.log('[TRACE-MW] Route:', pathname)

      // Check if user has completed onboarding (partnership + survey + reviewed)
      const { data: membership } = await supabase
        .from('partnership_members')
        .select('partnership_id, survey_reviewed, role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (membership?.partnership_id) {
        // DEFENSIVE GUARD: Validate partnership_id before querying
        const partnershipId = membership.partnership_id
        if (!partnershipId || typeof partnershipId !== 'string' || partnershipId.length < 10) {
          console.warn('[TRACE-MW] ⚠️ Invalid partnershipId in onboarding check:', partnershipId)
          console.log('[TRACE-MW] Allowing access to onboarding to fix data')
        } else {
          console.log('[TRACE-MW] ✅ Querying survey by user_id:', session.user.id)
          const { data: surveyData, error: surveyError } = await supabase
            .from('user_survey_responses')
            .select('completion_pct')
            .eq('user_id', session.user.id)
            .maybeSingle()

          if (surveyError) {
            console.error('[TRACE-MW] ❌ Error fetching survey in onboarding check:', surveyError.message)
          }

          const isComplete = surveyData?.completion_pct === 100 &&
            (membership.role === 'owner' || membership.survey_reviewed === true)

          console.log('[TRACE-MW] Onboarding completion check:', {
            hasPartnership: !!membership,
            completionPct: surveyData?.completion_pct,
            reviewed: membership.survey_reviewed,
            isComplete,
            error: surveyError?.message
          })
          console.log('[TRACE-MW] completionPct=%s reviewed=%s isComplete=%s',
            surveyData?.completion_pct,
            membership.survey_reviewed,
            isComplete
          )

          if (isComplete) {
            // User has completed onboarding, redirect to dashboard
            console.log('[TRACE-MW] ✅ User completed onboarding, redirecting to dashboard')
            console.log('[TRACE-MW] Redirect target: /dashboard')
            console.log('[TRACE-MW] =========================================')
            return NextResponse.redirect(new URL('/dashboard', request.url))
          }
        }
      }

      console.log('[TRACE-MW] User still in onboarding, allowing access')
      console.log('[TRACE-MW] Decision: next() - allow onboarding access')
      console.log('[TRACE-MW] =========================================')
    }

    return response
  }

  // Check if we have auth cookies before even trying to get session
  // This prevents race conditions where session hasn't loaded yet
  const authCookies = request.cookies.getAll().filter(c =>
    c.name.startsWith('sb-') && c.name.includes('auth-token')
  )

  console.log('[Middleware] Auth cookies found:', authCookies.length)

  // If we have auth cookies, assume user is authenticated and let page handle validation
  // The AuthContext on the page will properly validate and refresh the session
  if (authCookies.length > 0) {
    console.log('[Middleware] Auth cookies present, allowing access to', pathname)
    // Continue to protected route checks below
  } else {
    // No auth cookies at all - definitely not authenticated
    console.log('[Middleware] No auth cookies, redirecting to login')
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Double-check with session (but don't block if this fails)
  const { data: { session }, error } = await supabase.auth.getSession()

  console.log('[Middleware] Session check for', pathname, {
    hasSession: !!session,
    userId: session?.user?.id,
    expiresAt: session?.expires_at,
    error: error?.message
  })

  // If session check fails but we have cookies, redirect to login to refresh
  // Don't allow page to load with stale/invalid cookies
  if (!session && authCookies.length > 0) {
    console.log('[Middleware] Session failed but cookies present, redirecting to login to refresh')
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Protected routes that require complete onboarding
  const protectedRoutes = ['/dashboard', '/discovery', '/chat', '/connections', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    console.log('[TRACE-MW] ===== PROTECTED ROUTE CHECK =====')
    console.log('[TRACE-MW] Route:', pathname)
    console.log('[TRACE-MW] User ID:', session.user.id)
    console.log('[TRACE-MW] User email:', session.user.email)

    // Check if user has a partnership
    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('partnership_id, survey_reviewed, role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    console.log('[MW] Partnership membership:', {
      hasPartnership: !!membership,
      partnershipId: membership?.partnership_id,
      role: membership?.role,
      surveyReviewed: membership?.survey_reviewed,
      error: membershipError?.message
    })

    if (!membership) {
      // No partnership - redirect to onboarding
      logOnboardingGate({
        email: session.user.email,
        userId: session.user.id,
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
        email: session.user.email,
        userId: session.user.id,
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
    console.log('[TRACE-MW] ✅ Querying survey by user_id:', session.user.id)

    // Check user's survey completion (stable across partnership changes)
    const { data: surveyData, error: surveyError } = await supabase
      .from('user_survey_responses')
      .select('completion_pct')
      .eq('user_id', session.user.id)
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
      session.user.email,
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
      const resumePath = await flowController.getResumeStep(session.user.id)

      console.log('[TRACE-MW] getResumeStep returned:', resumePath)

      // If resumePath is null, onboarding is complete - allow access
      if (!resumePath) {
        logOnboardingGate({
          email: session.user.email,
          userId: session.user.id,
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
          email: session.user.email,
          userId: session.user.id,
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
        email: session.user.email,
        userId: session.user.id,
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