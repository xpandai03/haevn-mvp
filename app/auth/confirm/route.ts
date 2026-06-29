import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { OnboardingFlowController } from '@/lib/onboarding/flow'
import { HAEVN_AUTH_COOKIE_NAME, HAEVN_AUTH_COOKIE_OPTIONS } from '@/lib/supabase/cookieName'

// Hardcoded fallback because NEXT_PUBLIC_SUPABASE_URL may be misconfigured at
// runtime; same pattern as lib/supabase/{client,server}.ts and the callback.
const KNOWN_SUPABASE_URL = 'https://sdepasybfkmxcswaxnsz.supabase.co'

function getSupabaseUrl(): string {
  const candidates = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]
    .filter(Boolean)
    .map((u) => u!.replace(/\/+$/, ''))
  for (const url of candidates) {
    if (url.includes('supabase.co') || url.includes('supabase.in')) return url
  }
  return KNOWN_SUPABASE_URL
}

/**
 * Email-link confirmation via token_hash + verifyOtp.
 *
 * Why this exists separately from /auth/callback:
 *
 *   /auth/callback handles the PKCE `?code=` flow for Google OAuth. That flow
 *   requires the code-verifier cookie that signInWithOAuth/signInWithOtp wrote
 *   in the SAME browser. Email magic links break that assumption: a link that
 *   is sent to the user (server-initiated) or opened from an email app in a
 *   different browser than the one that requested it has NO verifier, so
 *   exchangeCodeForSession fails — and the user can never sign in.
 *
 *   The token_hash flow does NOT depend on a browser-stored verifier: the email
 *   template embeds {{ .TokenHash }}, and verifyOtp({ type, token_hash })
 *   validates it server-side and sets the session. This works no matter where
 *   the link is opened, which is exactly what passwordless imported users need.
 *
 * Links here look like:
 *   /auth/confirm?token_hash=<hash>&type=magiclink
 * type is one of EmailOtpType (magiclink | signup | invite | recovery |
 * email_change | email) so the SAME route serves every email template.
 *
 * Cookie handling mirrors /auth/callback: cookies set during verifyOtp are
 * collected on a placeholder response and copied onto the final redirect, so
 * the browser actually receives the Set-Cookie header (Next.js 15 route
 * handlers don't reliably auto-propagate cookieStore writes to redirects).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const origin = url.origin

  if (!token_hash || !type) {
    console.error('[TRACE-CONFIRM] missing token_hash or type')
    return NextResponse.redirect(`${origin}/auth/login?error=missing_token`)
  }

  const cookieJar = NextResponse.next()
  const supabase = createServerClient(getSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: HAEVN_AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieJar.cookies.set(name, value, options)
        })
      },
    },
  })

  let verifyError: any = null
  try {
    const result = await supabase.auth.verifyOtp({ type, token_hash })
    verifyError = result.error
  } catch (thrown) {
    verifyError = thrown
  }

  if (verifyError) {
    console.error('[TRACE-CONFIRM] verifyOtp failed:', {
      name: verifyError?.name,
      message: verifyError?.message,
      status: verifyError?.status,
    })
    const reason = encodeURIComponent((verifyError?.message || 'unknown').slice(0, 240))
    // Note: deliberately NOT bounced to Google — these are email-link users.
    return NextResponse.redirect(`${origin}/auth/login?error=otp_verify&reason=${reason}`)
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    console.warn('[TRACE-CONFIRM] no session after verifyOtp')
    return NextResponse.redirect(`${origin}/auth/login?error=otp_no_session`)
  }

  // Recovery links must land on the password-reset screen, not the dashboard.
  let target: string
  if (type === 'recovery') {
    target = '/auth/reset-password'
  } else {
    const resumePath = await new OnboardingFlowController(supabase).getResumeStep(session.user.id)
    target = resumePath ?? '/splash?splash=1'
  }

  console.log('[TRACE-CONFIRM] verified', session.user.email, '-> ', target)

  const response = NextResponse.redirect(`${origin}${target}`)
  cookieJar.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie)
  })
  return response
}
