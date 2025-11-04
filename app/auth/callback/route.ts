import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the session to check survey status
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        console.log('[Callback] ===== AUTH CALLBACK =====')
        console.log('[Callback] User:', session.user.email)
        console.log('[Callback] User ID:', session.user.id)

        // Use getOnboardingFlowController to determine redirect
        // This ensures consistency with login page and middleware
        const { getOnboardingFlowController } = await import('@/lib/onboarding/flow')
        const flowController = getOnboardingFlowController()
        const resumePath = await flowController.getResumeStep(session.user.id)

        console.log('[Callback] getResumeStep returned:', resumePath)
        console.log('[Callback] =========================================')

        return NextResponse.redirect(`${origin}${resumePath}`)
      }
    }
  }

  // If no code or error, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`)
}