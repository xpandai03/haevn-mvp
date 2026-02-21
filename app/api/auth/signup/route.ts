import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/signup
 *
 * Fully instrumented signup route.
 * Logs every outbound request URL, method, headers, and response details.
 */

/** Instrumented fetch — logs exact request + response details, never throws. */
async function instrumentedFetch(
  label: string,
  url: string,
  opts: RequestInit
): Promise<{ status: number; data: any; raw: string; ok: boolean; redirected: boolean; finalUrl: string; log: string }> {
  const log: string[] = []
  log.push(`[${label}] >>> ${opts.method || 'GET'} ${url}`)
  log.push(`[${label}] headers: ${JSON.stringify({
    'Content-Type': (opts.headers as any)?.['Content-Type'],
    'apikey': (opts.headers as any)?.['apikey'] ? `${String((opts.headers as any)['apikey']).slice(0, 10)}...` : 'MISSING',
    'Authorization': (opts.headers as any)?.['Authorization'] ? `${String((opts.headers as any)['Authorization']).slice(0, 20)}...` : 'MISSING',
  })}`)

  try {
    // Use redirect: 'manual' to detect if GoTrue is redirecting (which
    // would cause POST→GET conversion and result in 405)
    const res = await fetch(url, { ...opts, redirect: 'manual' })
    const raw = await res.text()

    log.push(`[${label}] <<< HTTP ${res.status} ${res.statusText}`)
    log.push(`[${label}] response content-type: ${res.headers.get('content-type')}`)
    log.push(`[${label}] response location: ${res.headers.get('location') || 'none'}`)
    log.push(`[${label}] response body (first 300): ${raw.slice(0, 300)}`)

    let data: any = null
    try { data = raw ? JSON.parse(raw) : null } catch { /* non-JSON */ }

    const logStr = log.join('\n')
    console.log(logStr)

    // If we got a redirect, follow it manually with POST preserved
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location')
      if (location) {
        const redirectUrl = location.startsWith('http') ? location : new URL(location, url).toString()
        log.push(`[${label}] FOLLOWING REDIRECT → ${redirectUrl} (preserving POST)`)
        console.log(`[${label}] FOLLOWING REDIRECT → ${redirectUrl}`)
        const redirectRes = await fetch(redirectUrl, opts)
        const redirectRaw = await redirectRes.text()
        log.push(`[${label}] redirect response: HTTP ${redirectRes.status} body=${redirectRaw.slice(0, 200)}`)
        console.log(`[${label}] redirect response: HTTP ${redirectRes.status}`)
        let redirectData: any = null
        try { redirectData = redirectRaw ? JSON.parse(redirectRaw) : null } catch { /* non-JSON */ }
        return { status: redirectRes.status, data: redirectData, raw: redirectRaw.slice(0, 500), ok: redirectRes.ok, redirected: true, finalUrl: redirectUrl, log: log.join('\n') }
      }
    }

    return { status: res.status, data, raw: raw.slice(0, 500), ok: res.ok, redirected: false, finalUrl: url, log: logStr }
  } catch (e: any) {
    const errMsg = `fetch error: ${e?.message}`
    log.push(`[${label}] !!! ${errMsg}`)
    console.error(log.join('\n'))
    return { status: 0, data: null, raw: errMsg, ok: false, redirected: false, finalUrl: url, log: log.join('\n') }
  }
}

export async function POST(request: Request) {
  console.log('SIGNUP_BUILD_MARKER=2026-02-21T3')

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

    // ── Environment variable diagnostics ──────────────────────────
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    const envInfo = {
      supabaseUrl_set: !!supabaseUrl,
      supabaseUrl_value: supabaseUrl ? `${supabaseUrl.slice(0, 40)}...` : 'EMPTY',
      supabaseUrl_length: supabaseUrl.length,
      anonKey_set: !!anonKey,
      anonKey_prefix: anonKey.slice(0, 10),
      serviceRoleKey_set: !!serviceRoleKey,
      serviceRoleKey_prefix: serviceRoleKey.slice(0, 10),
    }
    console.log('[Signup] ENV:', JSON.stringify(envInfo))
    diagnostics.push(`env: ${JSON.stringify(envInfo)}`)

    if (!supabaseUrl) {
      return NextResponse.json({
        success: false,
        error: 'NEXT_PUBLIC_SUPABASE_URL is not set on the server.',
        diagnostics
      }, { status: 500 })
    }
    if (!anonKey) {
      return NextResponse.json({
        success: false,
        error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set on the server.',
        diagnostics
      }, { status: 500 })
    }

    // ── Attempt 1: Admin API via service-role client ──────────────
    step = 'admin_create'
    if (serviceRoleKey) {
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
    } else {
      diagnostics.push('admin_create: skipped (no SERVICE_ROLE_KEY)')
    }

    // ── Attempt 2: Direct GoTrue POST /auth/v1/signup ────────────
    step = 'gotrue_signup'
    const signupUrl = `${supabaseUrl}/auth/v1/signup`
    const signupResult = await instrumentedFetch('gotrue_signup', signupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ email, password, data: metadata || {} })
    })
    diagnostics.push(`gotrue_signup: url=${signupUrl} status=${signupResult.status} redirected=${signupResult.redirected} body=${signupResult.raw.slice(0, 80)}`)

    if (signupResult.ok && signupResult.data?.id) {
      return NextResponse.json({ success: true, userId: signupResult.data.id, email, method: 'gotrue_signup' })
    }

    // Check for "already registered" from GoTrue
    const signupMsg = (signupResult.data?.msg || signupResult.data?.error_description || signupResult.data?.message || '').toLowerCase()
    if (signupMsg.includes('already') || signupMsg.includes('registered') || signupMsg.includes('exists')) {
      return NextResponse.json({
        success: false,
        error: 'An account with this email already exists. Please sign in or reset your password.',
        code: 'account_exists',
        diagnostics
      }, { status: 409 })
    }

    // ── Attempt 3: Verify via POST /auth/v1/token?grant_type=password ──
    step = 'verify_signin'
    await new Promise(r => setTimeout(r, 1000))

    const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`
    const signInResult = await instrumentedFetch('verify_signin', tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ email, password })
    })
    diagnostics.push(`verify_signin: url=${tokenUrl} status=${signInResult.status} redirected=${signInResult.redirected} has_token=${!!signInResult.data?.access_token}`)

    if (signInResult.ok && signInResult.data?.access_token) {
      const userId = signInResult.data.user?.id
      console.log(`[Signup] User verified via signIn! id=${userId}`)
      return NextResponse.json({ success: true, userId, email, method: 'verified_via_signin' })
    }

    // ── Attempt 4: GoTrue signup with service-role key ───────────
    if (serviceRoleKey) {
      step = 'gotrue_signup_srk'
      const srkResult = await instrumentedFetch('gotrue_signup_srk', signupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ email, password, data: metadata || {} })
      })
      diagnostics.push(`gotrue_signup_srk: status=${srkResult.status} redirected=${srkResult.redirected} body=${srkResult.raw.slice(0, 80)}`)

      if (srkResult.ok && srkResult.data?.id) {
        return NextResponse.json({ success: true, userId: srkResult.data.id, email, method: 'gotrue_signup_srk' })
      }

      // Second signIn verification after SRK attempt
      step = 'verify_signin_2'
      await new Promise(r => setTimeout(r, 1000))
      const signIn2 = await instrumentedFetch('verify_signin_2', tokenUrl, {
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
        const userId = signIn2.data.user?.id
        return NextResponse.json({ success: true, userId, email, method: 'verified_via_signin_2' })
      }
    }

    // ── All attempts failed ──────────────────────────────────────
    console.error('[Signup] ALL METHODS FAILED. Diagnostics:', JSON.stringify(diagnostics, null, 2))

    return NextResponse.json({
      success: false,
      error: 'Signup could not be completed. See diagnostics for details.',
      code: 'all_methods_failed',
      diagnostics
    }, { status: 502 })

  } catch (error: any) {
    console.error(`[Signup] Unexpected error at "${step}":`, error?.message)
    return NextResponse.json(
      { success: false, error: `Server error at "${step}": ${error?.message || 'unknown'}`, step, diagnostics },
      { status: 500 }
    )
  }
}
