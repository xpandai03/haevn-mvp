import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/signup
 *
 * Robust server-side signup that handles GoTrue returning empty/malformed
 * responses. Strategy:
 *
 * 1. Try admin createUser (fast path, works when GoTrue is healthy)
 * 2. If that fails, call GoTrue /signup directly via fetch (safe parsing)
 * 3. Verify the user was actually created by attempting signIn
 * 4. If signIn works → user exists, return success
 * 5. If nothing works → return combined diagnostics
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Safe fetch + JSON parse helper — never throws on bad responses. */
async function safeFetch(
  url: string,
  opts: RequestInit
): Promise<{ status: number; data: any; raw: string; ok: boolean }> {
  try {
    const res = await fetch(url, opts)
    const raw = await res.text()
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      // non-JSON response — keep data as null
    }
    return { status: res.status, data, raw: raw.slice(0, 500), ok: res.ok }
  } catch (e: any) {
    return { status: 0, data: null, raw: e?.message || 'fetch failed', ok: false }
  }
}

export async function POST(request: Request) {
  console.log('SIGNUP_BUILD_MARKER=2026-02-21T2')

  let step = 'init'
  const diagnostics: string[] = []

  try {
    step = 'parse_body'
    const body = await request.json()
    const { email, password, metadata } = body

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    console.log(`[Signup] Starting signup for: ${email}`)
    console.log(`[Signup] ENV check: URL=${!!SUPABASE_URL} ANON=${!!ANON_KEY} SRK=${!!SERVICE_ROLE_KEY}`)

    // ── Attempt 1: Admin API via service-role client ──────────────
    step = 'admin_create'
    try {
      const supabase = await createServiceRoleClient()
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata || {}
      })

      if (!error && data?.user) {
        console.log(`[Signup] Admin API succeeded: ${data.user.id}`)
        return NextResponse.json({ success: true, userId: data.user.id, email: data.user.email, method: 'admin' })
      }

      const msg = error?.message || 'no user returned'
      console.log(`[Signup] Admin API failed: ${msg}`)
      diagnostics.push(`admin_create: ${msg}`)
    } catch (e: any) {
      console.log(`[Signup] Admin API threw: ${e?.message}`)
      diagnostics.push(`admin_create_throw: ${e?.message}`)
    }

    // ── Attempt 2: Direct GoTrue /signup (with anon key) ─────────
    step = 'gotrue_signup'
    console.log(`[Signup] Trying direct GoTrue signup...`)
    const signupResult = await safeFetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        email,
        password,
        data: metadata || {},
        gotrue_meta_security: { captcha_token: '' }
      })
    })

    console.log(`[Signup] GoTrue signup response: status=${signupResult.status} ok=${signupResult.ok} raw=${signupResult.raw.slice(0, 200)}`)
    diagnostics.push(`gotrue_signup: status=${signupResult.status} body=${signupResult.raw.slice(0, 100)}`)

    // If GoTrue returned a clear success with user data
    if (signupResult.ok && signupResult.data?.id) {
      console.log(`[Signup] GoTrue signup succeeded: ${signupResult.data.id}`)
      return NextResponse.json({ success: true, userId: signupResult.data.id, email, method: 'gotrue_signup' })
    }

    // If GoTrue returned a clear "already registered" error
    if (signupResult.data?.msg?.toLowerCase().includes('already') ||
        signupResult.data?.error_description?.toLowerCase().includes('already')) {
      return NextResponse.json({
        success: false,
        error: 'An account with this email already exists. Please use the login page or reset your password.',
        code: 'account_exists'
      }, { status: 409 })
    }

    // ── Attempt 3: Verify if user was created despite broken response ──
    // GoTrue may have created the user but returned empty/broken body.
    // Check by trying to sign in with the password.
    step = 'verify_signin'
    console.log(`[Signup] Verifying if user was created by attempting signIn...`)

    // Small delay to let GoTrue finish any async work
    await new Promise(r => setTimeout(r, 1500))

    const signInResult = await safeFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({ email, password })
    })

    console.log(`[Signup] SignIn verify: status=${signInResult.status} ok=${signInResult.ok} has_token=${!!signInResult.data?.access_token}`)
    diagnostics.push(`verify_signin: status=${signInResult.status}`)

    if (signInResult.ok && signInResult.data?.access_token) {
      // User exists and password works — signup DID succeed
      const userId = signInResult.data.user?.id
      console.log(`[Signup] User verified via signIn! id=${userId}`)
      return NextResponse.json({ success: true, userId, email, method: 'verified_via_signin' })
    }

    // ── Attempt 4: Try GoTrue signup with service-role key ───────
    step = 'gotrue_signup_srk'
    console.log(`[Signup] Trying GoTrue signup with service-role key...`)
    const srkSignupResult = await safeFetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        email,
        password,
        data: metadata || {}
      })
    })

    console.log(`[Signup] SRK signup response: status=${srkSignupResult.status} ok=${srkSignupResult.ok} raw=${srkSignupResult.raw.slice(0, 200)}`)
    diagnostics.push(`gotrue_signup_srk: status=${srkSignupResult.status} body=${srkSignupResult.raw.slice(0, 100)}`)

    if (srkSignupResult.ok && srkSignupResult.data?.id) {
      console.log(`[Signup] SRK signup succeeded: ${srkSignupResult.data.id}`)
      return NextResponse.json({ success: true, userId: srkSignupResult.data.id, email, method: 'gotrue_signup_srk' })
    }

    // After SRK attempt, verify again
    step = 'verify_signin_2'
    await new Promise(r => setTimeout(r, 1500))

    const signIn2 = await safeFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({ email, password })
    })

    console.log(`[Signup] SignIn verify 2: status=${signIn2.status} has_token=${!!signIn2.data?.access_token}`)
    diagnostics.push(`verify_signin_2: status=${signIn2.status}`)

    if (signIn2.ok && signIn2.data?.access_token) {
      const userId = signIn2.data.user?.id
      console.log(`[Signup] User verified via signIn (round 2)! id=${userId}`)
      return NextResponse.json({ success: true, userId, email, method: 'verified_via_signin_2' })
    }

    // ── All attempts failed — return diagnostics ─────────────────
    step = 'all_failed'
    console.error(`[Signup] All signup methods failed for: ${email}`)
    console.error(`[Signup] Diagnostics:`, diagnostics)

    return NextResponse.json({
      success: false,
      error: 'Signup could not be completed. The auth service may be temporarily unavailable.',
      code: 'all_methods_failed',
      diagnostics
    }, { status: 502 })

  } catch (error: any) {
    console.error(`[Signup] Unexpected error at step "${step}":`, error?.message)
    return NextResponse.json(
      { success: false, error: `Server error at "${step}": ${error?.message || 'unknown'}`, step, diagnostics },
      { status: 500 }
    )
  }
}
