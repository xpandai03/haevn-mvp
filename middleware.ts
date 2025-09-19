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

  // Waitlist is special - requires auth but not onboarding
  const isWaitlistRoute = pathname === '/waitlist'

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

  // Allow onboarding routes and waitlist
  if (isOnboardingRoute || isWaitlistRoute) {
    return response
  }

  // Protected routes that require complete onboarding
  const protectedRoutes = ['/dashboard', '/discovery', '/chat', '/connections', '/profile']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    // Get user's partnership to check onboarding state
    const { data: membership } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', session.user.id)
      .single()

    if (!membership?.partnership_id) {
      // No partnership yet, start onboarding
      return NextResponse.redirect(new URL('/onboarding/expectations', request.url))
    }

    // Check onboarding state
    const { data: onboardingState } = await supabase
      .from('onboarding_state')
      .select('current_step, membership_selected')
      .eq('partnership_id', membership.partnership_id)
      .single()

    // If no state exists or onboarding incomplete, redirect to appropriate step
    if (!onboardingState) {
      return NextResponse.redirect(new URL('/onboarding/expectations', request.url))
    }

    if (!onboardingState.membership_selected) {
      // Map step number to route
      const stepRoutes: Record<number, string> = {
        2: '/onboarding/expectations',
        3: '/onboarding/welcome',
        4: '/onboarding/identity',
        5: '/onboarding/survey-intro', // Skip verification
        6: '/onboarding/survey-intro',
        7: '/onboarding/survey',
        8: '/onboarding/celebration',
        9: '/onboarding/membership',
      }

      const nextRoute = stepRoutes[onboardingState.current_step] || '/onboarding/expectations'
      return NextResponse.redirect(new URL(nextRoute, request.url))
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