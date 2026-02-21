import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/signup
 *
 * Server-side signup with hardened Supabase URL resolution.
 * NEXT_PUBLIC_ vars may not be available at runtime in Vercel serverless
 * functions, so we read from multiple sources and validate.
 */

console.log('SIGNUP_BUILD_MARKER=2026-02-21T4')

// Known Supabase project URL — hardcoded fallback because NEXT_PUBLIC_
// env vars are inlined at build time for client code but may be absent
// from the server runtime environment in Vercel.
const KNOWN_SUPABASE_URL = 'https://sdepasybfkmxcswaxnsz.supabase.co'

/** Resolve the real Supabase project URL from env vars with fallback. */
function getSupabaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ].filter(Boolean).map(u => u!.replace(/\/+$/, ''))

  // Pick the first one that looks like a Supabase URL
  for (const url of candidates) {
    if (url.includes('supabase.co') || url.includes('supabase.in')) {
      return url
    }
  }

  // Fallback to hardcoded known URL
  console.warn('[Signup] No valid Supabase URL in env vars, using hardcoded fallback')
  return KNOWN_SUPABASE_URL
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

/** Safe fetch — never throws, logs key details. */
async function safeFetch(
  label: string,
  url: string,
  opts: RequestInit
): Promise<{ status: number; data: any; raw: string; ok: boolean }> {
  try {
    console.log(`[${label}] POST ${url}`)
    const res = await fetch(url, opts)
    const raw = await res.text()
    console.log(`[${label}] Response: ${res.status} body=${raw.slice(0, 200)}`)
    let data: any = null
    try { data = raw ? JSON.parse(raw) : null } catch { /* non-JSON */ }
    return { status: res.status, data, raw: raw.slice(0, 500), ok: res.ok }
  } catch (e: any) {
    console.error(`[${label}] fetch error: ${e?.message}`)
    return { status: 0, data: null, raw: e?.message || 'fetch failed', ok: false }
  }
}

export async function POST(request: Request) {
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

    // ── Resolve and validate Supabase URL ─────────────────────────
    const supabaseUrl = getSupabaseUrl()
    const anonKey = getAnonKey()
    const serviceRoleKey = getServiceRoleKey()

    console.log(`[Signup] supabaseUrl=${supabaseUrl}`)
    console.log(`[Signup] anonKey set=${!!anonKey} (${anonKey.slice(0, 8)}...)`)
    console.log(`[Signup] serviceRoleKey set=${!!serviceRoleKey}`)
    diagnostics.push(`supabaseUrl=${supabaseUrl}`)

    if (!supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('supabase.in')) {
      return NextResponse.json({
        success: false,
        error: `Misconfigured: resolved Supabase URL does not point to Supabase (got: ${supabaseUrl}).`,
        code: 'misconfigured_supabase_url',
        diagnostics
      }, { status: 500 })
    }

    if (!anonKey) {
      return NextResponse.json({
        success: false,
        error: 'Server misconfigured: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.',
        diagnostics
      }, { status: 500 })
    }

    // ── Attempt 1: Admin API via service-role client ──────────────
    step = 'admin_create'
    if (serviceRoleKey) {
      try {
        const supabase = await createServiceRoleClient()
        const { data, error } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: metadata || {}
        })
        if (!error && data?.user) {
          console.log(`[Signup] Admin createUser succeeded: ${data.user.id}`)
          return NextResponse.json({ success: true, userId: data.user.id, email: data.user.email, method: 'admin' })
        }
        diagnostics.push(`admin_create: ${error?.message || 'no user'}`)
        console.log(`[Signup] Admin createUser failed: ${error?.message}`)
      } catch (e: any) {
        diagnostics.push(`admin_create_throw: ${e?.message}`)
        console.log(`[Signup] Admin createUser threw: ${e?.message}`)
      }
    }

    // ── Attempt 2: Direct GoTrue /signup with anon key ────────────
    step = 'gotrue_signup'
    const signupUrl = `${supabaseUrl}/auth/v1/signup`
    const signupResult = await safeFetch('gotrue_signup', signupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ email, password, data: metadata || {} })
    })
    diagnostics.push(`gotrue_signup: status=${signupResult.status} body=${signupResult.raw.slice(0, 80)}`)

    if (signupResult.ok && signupResult.data?.id) {
      return NextResponse.json({ success: true, userId: signupResult.data.id, email, method: 'gotrue_signup' })
    }

    // "Already registered" check
    const msg = (signupResult.data?.msg || signupResult.data?.error_description || '').toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return NextResponse.json({
        success: false,
        error: 'An account with this email already exists. Please sign in or reset your password.',
        code: 'account_exists', diagnostics
      }, { status: 409 })
    }

    // ── Attempt 3: Verify via signIn (user may exist despite empty response) ──
    step = 'verify_signin'
    await new Promise(r => setTimeout(r, 1000))
    const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`
    const signInResult = await safeFetch('verify_signin', tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ email, password })
    })
    diagnostics.push(`verify_signin: status=${signInResult.status} has_token=${!!signInResult.data?.access_token}`)

    if (signInResult.ok && signInResult.data?.access_token) {
      const userId = signInResult.data.user?.id
      return NextResponse.json({ success: true, userId, email, method: 'verified_via_signin' })
    }

    // ── Attempt 4: GoTrue /signup with service-role key ───────────
    if (serviceRoleKey) {
      step = 'gotrue_signup_srk'
      const srkResult = await safeFetch('gotrue_signup_srk', signupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ email, password, data: metadata || {} })
      })
      diagnostics.push(`gotrue_signup_srk: status=${srkResult.status} body=${srkResult.raw.slice(0, 80)}`)

      if (srkResult.ok && srkResult.data?.id) {
        return NextResponse.json({ success: true, userId: srkResult.data.id, email, method: 'gotrue_signup_srk' })
      }

      // Final signIn verification
      step = 'verify_signin_2'
      await new Promise(r => setTimeout(r, 1000))
      const signIn2 = await safeFetch('verify_signin_2', tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ email, password })
      })
      diagnostics.push(`verify_signin_2: status=${signIn2.status} has_token=${!!signIn2.data?.access_token}`)

      if (signIn2.ok && signIn2.data?.access_token) {
        return NextResponse.json({ success: true, userId: signIn2.data.user?.id, email, method: 'verified_via_signin_2' })
      }
    }

    // ── All failed ────────────────────────────────────────────────
    console.error('[Signup] All methods failed:', JSON.stringify(diagnostics))
    return NextResponse.json({
      success: false,
      error: 'Signup could not be completed. See diagnostics.',
      code: 'all_methods_failed',
      diagnostics
    }, { status: 502 })

  } catch (error: any) {
    console.error(`[Signup] Error at "${step}":`, error?.message)
    return NextResponse.json(
      { success: false, error: `Server error at "${step}": ${error?.message}`, step, diagnostics },
      { status: 500 }
    )
  }
}
