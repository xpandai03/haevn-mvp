import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { OnboardingFlowController } from '@/lib/onboarding/flow'

// Hardcoded fallback because NEXT_PUBLIC_SUPABASE_URL may be misconfigured
// at runtime; same pattern as lib/supabase/{client,server}.ts.
const KNOWN_SUPABASE_URL = 'https://sdepasybfkmxcswaxnsz.supabase.co'

function getSupabaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ]
    .filter(Boolean)
    .map((u) => u!.replace(/\/+$/, ''))

  for (const url of candidates) {
    if (url.includes('supabase.co') || url.includes('supabase.in')) {
      return url
    }
  }
  return KNOWN_SUPABASE_URL
}

/**
 * OAuth callback. Exchanges the PKCE code for a Supabase session and
 * decides where the user should land.
 *
 * Why the server client is constructed inline instead of using the
 * shared lib/supabase/server.ts helper:
 *
 *   The shared helper writes cookies to the next/headers cookieStore.
 *   That works for Server Components and most Route Handlers, but
 *   the auto-propagation of those cookie writes to a redirect response
 *   in a Route Handler is unreliable in Next.js 15. The first OAuth
 *   round-trip set the session cookie on the cookieStore but the
 *   actual redirect response went out without a Set-Cookie header,
 *   so the browser landed on /onboarding/expectations with no
 *   session — middleware/page guard then bounced the user to
 *   /auth/login. Clicking Google again worked because the browser
 *   client had cached the session from signInWithOAuth's local state
 *   by then.
 *
 *   The fix is the response-attached cookie pattern from Supabase's
 *   Next.js docs: the setAll callback writes cookies directly onto
 *   the NextResponse we're going to return. No reliance on
 *   cookieStore propagation.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const supabaseUrl = getSupabaseUrl()

  // Snapshot the cookies the browser actually sent on this request.
  // We need to know whether the PKCE code-verifier cookie that
  // signInWithOAuth wrote on the login page made it back to the
  // callback — without it, exchangeCodeForSession will fail with
  // "invalid request: both auth code and code verifier should be
  // non-empty" or similar. Names only; never log values.
  const incomingCookieNames = request.cookies.getAll().map((c) => c.name)
  const verifierCookieNames = incomingCookieNames.filter((n) =>
    n.includes('code-verifier') || n.includes('code_verifier')
  )
  const authCookieNames = incomingCookieNames.filter((n) =>
    n.startsWith('sb-') && n.includes('auth-token')
  )
  console.log('[TRACE-CB] ===== CALLBACK ENTRY =====')
  console.log('[TRACE-CB] request.url:', request.url)
  console.log('[TRACE-CB] origin:', origin)
  console.log('[TRACE-CB] supabaseUrl in use:', supabaseUrl)
  console.log('[TRACE-CB] code present:', !!code, 'len:', code?.length)
  console.log('[TRACE-CB] cookie count:', incomingCookieNames.length)
  console.log('[TRACE-CB] cookie names:', incomingCookieNames)
  console.log('[TRACE-CB] verifier cookies:', verifierCookieNames)
  console.log('[TRACE-CB] auth cookies:', authCookieNames)

  if (!code) {
    console.error('[TRACE-CB] missing code in querystring')
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`)
  }

  // Placeholder response — used to collect cookies set during the
  // exchange. We copy these cookies onto the final redirect response
  // once we know the target URL.
  const cookieJar = NextResponse.next()

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

  // Belt-and-suspenders: try/catch around exchangeCodeForSession in
  // case it throws synchronously (network, malformed config, etc.)
  // rather than returning { error }. Surface the actual error message
  // back to the login page so we can debug without Vercel logs.
  let exchangeError: any = null
  try {
    const result = await supabase.auth.exchangeCodeForSession(code)
    exchangeError = result.error
  } catch (thrown) {
    exchangeError = thrown
  }

  if (exchangeError) {
    const detail = {
      name: exchangeError?.name,
      message: exchangeError?.message,
      status: exchangeError?.status,
      code: exchangeError?.code,
      errorCode: exchangeError?.error_code,
    }
    console.error('[TRACE-CB] exchangeCodeForSession failed:', detail)
    console.error('[TRACE-CB] full error:', exchangeError)
    console.error('[TRACE-CB] verifier cookies present at failure:', verifierCookieNames)
    const reason = encodeURIComponent(
      (exchangeError?.message || 'unknown').slice(0, 240)
    )
    return NextResponse.redirect(
      `${origin}/auth/login?error=oauth_exchange&reason=${reason}`
    )
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    console.warn('[TRACE-CB] No session after successful exchange')
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_no_session`)
  }

  console.log('[TRACE-CB] ===== START CALLBACK =====')
  console.log('[TRACE-CB] User:', session.user.email, session.user.id)
  console.log('[TRACE-CB] Origin:', origin)

  // Use the SAME (just-authenticated) supabase client to look up the
  // user's onboarding state. The shared getServerOnboardingFlowController
  // would build a client off the request cookieStore, which doesn't see
  // the cookies we just set on the response.
  const flowController = new OnboardingFlowController(supabase)
  const resumePath = await flowController.getResumeStep(session.user.id)

  // null = onboarding complete -> route through /splash for the
  // logo-reveal interstitial. Server redirects can't set
  // sessionStorage so we pass ?splash=1 as the intent signal; the
  // splash page accepts that.
  const target = resumePath ?? '/splash?splash=1'
  console.log('[TRACE-CB] Resume path:', resumePath, '-> redirecting to', target)
  console.log('[TRACE-CB] ===== END CALLBACK =====')

  const response = NextResponse.redirect(`${origin}${target}`)

  // Copy session cookies set during the exchange onto the redirect
  // response so the browser actually receives the Set-Cookie header.
  cookieJar.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie)
  })

  return response
}
