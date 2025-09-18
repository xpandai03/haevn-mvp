import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/auth/signup', '/auth/login', '/auth/callback']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith('/auth/') || pathname.startsWith('/api/'))

  // Onboarding routes are protected but don't require survey completion
  // These routes are exempt from survey completion checks
  const onboardingRoutes = ['/onboarding/survey', '/onboarding/membership', '/waitlist']
  const isOnboardingRoute = onboardingRoutes.some(route => pathname.startsWith(route))

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

  // Skip survey check for onboarding routes
  if (isOnboardingRoute) {
    return response
  }

  // Protected routes that require survey completion
  const surveyRequiredRoutes = ['/dashboard', '/discovery', '/chat', '/connections', '/profile']
  const requiresSurvey = surveyRequiredRoutes.some(route => pathname.startsWith(route))

  if (requiresSurvey) {
    // Check profile for survey completion
    const { data: profile } = await supabase
      .from('profiles')
      .select('survey_complete')
      .eq('user_id', session.user.id)
      .single()

    if (!profile || !profile.survey_complete) {
      return NextResponse.redirect(new URL('/onboarding/survey', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]
}