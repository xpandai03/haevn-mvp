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
        // Check if user has a partnership and onboarding state
        const { data: membership } = await supabase
          .from('partnership_members')
          .select('partnership_id')
          .eq('user_id', session.user.id)
          .single()

        if (!membership?.partnership_id) {
          // No partnership yet, start onboarding
          return NextResponse.redirect(`${origin}/onboarding/expectations`)
        }

        // Check onboarding state
        const { data: onboardingState } = await supabase
          .from('onboarding_state')
          .select('current_step, membership_selected')
          .eq('partnership_id', membership.partnership_id)
          .single()

        // If no state or incomplete, redirect to appropriate step
        if (!onboardingState || !onboardingState.membership_selected) {
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

          const nextRoute = stepRoutes[onboardingState?.current_step || 2] || '/onboarding/expectations'
          return NextResponse.redirect(`${origin}${nextRoute}`)
        }

        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }
  }

  // If no code or error, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`)
}