import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
  const publicRoutes = ['/', '/auth/signup', '/auth/login', '/auth/callback']
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
        const { data: surveyData } = await supabase
          .from('user_survey_responses')
          .select('completion_pct')
          .eq('partnership_id', membership.partnership_id)
          .maybeSingle()

        const isComplete = surveyData?.completion_pct === 100 && membership.survey_reviewed === true

        console.log('[TRACE-MW] Onboarding completion check:', {
          hasPartnership: !!membership,
          completionPct: surveyData?.completion_pct,
          reviewed: membership.survey_reviewed,
          isComplete
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

  // If session check fails but we have cookies, let the page handle it
  // The page's AuthContext will properly validate and refresh
  if (!session && authCookies.length > 0) {
    console.log('[Middleware] Session failed but cookies present, allowing page to handle auth')
    return response
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
      console.log('[Middleware] ❌ No partnership found, redirecting to expectations')
      console.log('[Middleware] =========================================')
      return NextResponse.redirect(new URL('/onboarding/expectations', request.url))
    }

    // Check partnership survey completion (NOT user survey)
    const { data: surveyData, error: surveyError } = await supabase
      .from('user_survey_responses')
      .select('completion_pct')
      .eq('partnership_id', membership.partnership_id)
      .maybeSingle()

    console.log('[MW] Partnership survey check:', {
      hasSurveyData: !!surveyData,
      completionPct: surveyData?.completion_pct,
      error: surveyError?.message
    })

    // DATABASE-FIRST PRIORITY: Survey completion AND review are source of truth
    const isComplete = surveyData?.completion_pct === 100 && membership.survey_reviewed === true
    console.log('[TRACE-MW] user=%s pct=%s reviewed=%s path=%s decision=%s',
      session.user.email,
      surveyData?.completion_pct,
      membership.survey_reviewed,
      pathname,
      isComplete ? 'ALLOW' : 'REDIRECT'
    )

    // Require survey completion AND user review before accessing protected routes
    if (!isComplete) {
      console.log('[TRACE-MW] ❌ Survey incomplete or not reviewed, redirecting')
      console.log('[TRACE-MW] Survey complete:', surveyData?.completion_pct === 100)
      console.log('[TRACE-MW] Survey reviewed:', membership.survey_reviewed)
      console.log('[TRACE-MW] About to call getResumeStep()')

      // Use flow controller to determine correct redirect
      // Import dynamically to avoid circular dependencies
      const { getOnboardingFlowController } = await import('@/lib/onboarding/flow')
      const flowController = getOnboardingFlowController()
      const resumePath = await flowController.getResumeStep(session.user.id)

      console.log('[TRACE-MW] getResumeStep returned:', resumePath)
      console.log('[TRACE-MW] Redirecting to:', resumePath)
      console.log('[TRACE-MW] =========================================')
      return NextResponse.redirect(new URL(resumePath, request.url))
    }

    console.log('[TRACE-MW] ✅ All checks passed, allowing access to', pathname)
    console.log('[TRACE-MW] Decision: next() - allow protected route')
    console.log('[TRACE-MW] =========================================')
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