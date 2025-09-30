import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/auth/signup', '/auth/login', '/auth/callback']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith('/auth/') || pathname.startsWith('/api/'))

  // Onboarding routes - protected but allow progression through flow
  const isOnboardingRoute = pathname.startsWith('/onboarding/')

  // Skip auth check for public routes
  if (isPublicRoute) {
    return response
  }

  // Create a Supabase client configured to use cookies
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

  // Check if we have a session
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect to login if no session and accessing protected route
  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Allow onboarding routes - let the pages handle their own flow
  if (isOnboardingRoute) {
    return response
  }

  // Protected routes that require complete onboarding
  const protectedRoutes = ['/dashboard', '/discovery', '/chat', '/connections', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    // Check survey completion first (most important)
    const { data: surveyData } = await supabase
      .from('user_survey_responses')
      .select('completion_pct')
      .eq('user_id', session.user.id)
      .maybeSingle()

    // If survey not complete or doesn't exist, redirect to survey
    if (!surveyData || surveyData.completion_pct < 100) {
      return NextResponse.redirect(new URL('/onboarding/survey', request.url))
    }

    // Check onboarding state (may not exist if user signed up before this feature)
    const { data: onboardingState } = await supabase
      .from('user_onboarding_state')
      .select('membership_selected')
      .eq('user_id', session.user.id)
      .maybeSingle()

    // If state exists and membership not selected, redirect
    if (onboardingState && !onboardingState.membership_selected) {
      return NextResponse.redirect(new URL('/onboarding/membership', request.url))
    }

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