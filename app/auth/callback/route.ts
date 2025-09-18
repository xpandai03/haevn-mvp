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
        // Check if user has completed survey
        const { data: profile } = await supabase
          .from('profiles')
          .select('survey_complete')
          .eq('user_id', session.user.id)
          .single()

        // Redirect based on survey completion
        if (!profile || !profile.survey_complete) {
          return NextResponse.redirect(`${origin}/onboarding/survey`)
        }

        return NextResponse.redirect(`${origin}/dashboard`)
      }
    }
  }

  // If no code or error, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`)
}