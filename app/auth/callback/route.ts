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
        console.log('[TRACE-CB] ===== START CALLBACK =====')
        console.log('[TRACE-CB] Start callback for', session.user.email)
        console.log('[TRACE-CB] User ID:', session.user.id)
        console.log('[TRACE-CB] Origin:', origin)

        // Use getOnboardingFlowController to determine redirect
        // This ensures consistency with login page and middleware
        console.log('[TRACE-CB] About to call getResumeStep()')
        const { getOnboardingFlowController } = await import('@/lib/onboarding/flow')
        const flowController = getOnboardingFlowController()
        const resumePath = await flowController.getResumeStep(session.user.id)

        console.log('[TRACE-CB] getResumeStep resolved to', resumePath)
        console.log('[TRACE-CB] Building redirect URL:', `${origin}${resumePath}`)
        console.log('[TRACE-CB] About to redirect...')
        console.log('[TRACE-CB] ===== END CALLBACK =====')

        return NextResponse.redirect(`${origin}${resumePath}`)
      }
    }
  }

  // If no code or error, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`)
}