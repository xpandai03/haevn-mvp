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

  // Skip auth check for public routes, API routes, and onboarding routes
  // API routes will handle their own auth checks
  // Onboarding routes handle their own auth checks
  if (isPublicRoute || isApiRoute || isOnboardingRoute) {
    return response
  }

  // Check if we have a session for protected routes
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect to login if no session and accessing protected route
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Protected routes that require complete onboarding
  const protectedRoutes = ['/dashboard', '/discovery', '/chat', '/connections', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    console.log('[Middleware] ===== PROTECTED ROUTE CHECK =====')
    console.log('[Middleware] Route:', pathname)
    console.log('[Middleware] User ID:', session.user.id)

    // Check if user has completed all required onboarding steps
    // For now, we'll check if survey is complete and membership is selected
    // as these are the final gates before accessing protected routes

    const { data: surveyData, error: surveyError } = await supabase
      .from('user_survey_responses')
      .select('completion_pct')
      .eq('user_id', session.user.id)
      .maybeSingle()

    console.log('[Middleware] Survey check result:', {
      hasSurveyData: !!surveyData,
      completionPct: surveyData?.completion_pct,
      error: surveyError?.message
    })

    // If survey not complete, redirect to first incomplete onboarding step
    if (!surveyData || surveyData.completion_pct < 100) {
      console.log('[Middleware] ❌ Survey incomplete, redirecting to expectations')
      console.log('[Middleware] =========================================')
      // Start at expectations - the flow controller in each page will handle navigation
      return NextResponse.redirect(new URL('/onboarding/expectations', request.url))
    }

    // Check onboarding state (may not exist if user signed up before this feature)
    const { data: onboardingState } = await supabase
      .from('user_onboarding_state')
      .select('membership_selected')
      .eq('user_id', session.user.id)
      .maybeSingle()

    console.log('[Middleware] Onboarding state:', {
      hasState: !!onboardingState,
      membershipSelected: onboardingState?.membership_selected
    })

    // If state exists and membership not selected, redirect
    if (onboardingState && !onboardingState.membership_selected) {
      console.log('[Middleware] ❌ Membership not selected, redirecting')
      console.log('[Middleware] =========================================')
      return NextResponse.redirect(new URL('/onboarding/membership', request.url))
    }

    console.log('[Middleware] ✅ All checks passed, allowing access')
    console.log('[Middleware] =========================================')
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