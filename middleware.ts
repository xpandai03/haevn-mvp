import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Protected routes that require survey completion
  const surveyRequiredRoutes = ['/discovery', '/chat', '/matches']

  // Protected routes that require paid membership
  const paidMembershipRoutes = ['/discovery', '/chat', '/matches']

  // Check if route requires protection
  const requiresSurvey = surveyRequiredRoutes.some(route => pathname.startsWith(route))
  const requiresPaidMembership = paidMembershipRoutes.some(route => pathname.startsWith(route))

  if (requiresSurvey || requiresPaidMembership) {
    // In a real app, we'd check the database/session
    // For now, we'll let the client-side handle the redirect
    // This is a placeholder for proper server-side validation

    // You could implement cookie-based checking here:
    // const userCookie = request.cookies.get('haevn_user')
    // if (userCookie) {
    //   const user = JSON.parse(userCookie.value)
    //   if (!user.surveyCompleted) {
    //     return NextResponse.redirect(new URL('/onboarding/survey', request.url))
    //   }
    // }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protected routes
    '/discovery/:path*',
    '/chat/:path*',
    '/matches/:path*',
    // Skip static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ]
}