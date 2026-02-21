import { NextResponse } from 'next/server'

/**
 * POST /api/auth/signup
 *
 * Server-side signup using direct GoTrue REST API calls.
 * Bypasses the Supabase JS SDK entirely to avoid HTML-response edge cases
 * when the SDK's internal JSON parsing fails.
 *
 * Flow:
 * 1. Try to create user via GoTrue admin API
 * 2. If "already registered" → delete the remnant user, then retry
 * 3. Return proper JSON on every path
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Call GoTrue admin API and return parsed JSON or an error string. */
async function gotrueAdmin(
  method: string,
  path: string,
  body?: any
): Promise<{ ok: boolean; status: number; data: any; rawError?: string }> {
  const url = `${SUPABASE_URL}/auth/v1/admin${path}`
  console.log(`[GoTrue] ${method} ${url}`)

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })

  const text = await res.text()

  // Handle non-JSON responses (HTML error pages, empty bodies)
  if (!text || text.trim().length === 0) {
    return { ok: false, status: res.status, data: null, rawError: `Empty response (HTTP ${res.status})` }
  }

  try {
    const data = JSON.parse(text)
    // GoTrue returns error objects like { error: "message", msg: "message", code: 422 }
    if (!res.ok) {
      const errMsg = data?.msg || data?.error || data?.message || data?.error_description || JSON.stringify(data)
      return { ok: false, status: res.status, data, rawError: errMsg }
    }
    return { ok: true, status: res.status, data }
  } catch {
    // Response is not JSON (HTML error page, etc.)
    console.error(`[GoTrue] Non-JSON response (HTTP ${res.status}):`, text.slice(0, 300))
    return { ok: false, status: res.status, data: null, rawError: `GoTrue returned non-JSON (HTTP ${res.status}). Check service role key.` }
  }
}

export async function POST(request: Request) {
  let step = 'init'
  try {
    // Validate env vars
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Server misconfigured: missing Supabase credentials.', code: 'config_error' },
        { status: 500 }
      )
    }

    step = 'parse_body'
    const body = await request.json()
    const { email, password, metadata } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      )
    }

    // Step 1: Try to create the user directly
    step = 'create_user'
    console.log('[API Signup] Creating user:', email)
    const createResult = await gotrueAdmin('POST', '/users', {
      email,
      password,
      email_confirm: true,
      user_metadata: metadata || {}
    })

    if (createResult.ok) {
      console.log('[API Signup] User created:', createResult.data?.id)
      return NextResponse.json({
        success: true,
        userId: createResult.data?.id,
        email: createResult.data?.email
      })
    }

    // Step 2: If user already exists, find and delete the remnant
    const errMsg = (createResult.rawError || '').toLowerCase()
    const isAlreadyExists =
      errMsg.includes('already') ||
      errMsg.includes('exists') ||
      errMsg.includes('registered') ||
      errMsg.includes('duplicate') ||
      createResult.status === 422

    if (!isAlreadyExists) {
      // Some other error — return it
      console.error('[API Signup] createUser failed (not a duplicate):', createResult.rawError)
      return NextResponse.json(
        { success: false, error: createResult.rawError || 'Account creation failed.', code: 'create_failed', step },
        { status: createResult.status >= 400 ? createResult.status : 500 }
      )
    }

    console.log('[API Signup] User already exists, looking up for cleanup...')

    // Step 3: Find the existing user by listing users
    step = 'find_existing'
    const listResult = await gotrueAdmin('GET', `/users?page=1&per_page=50`)

    let existingUserId: string | null = null

    if (listResult.ok && listResult.data?.users) {
      const match = listResult.data.users.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      )
      if (match) {
        existingUserId = match.id
        console.log('[API Signup] Found existing user:', existingUserId)
      }
    } else {
      console.warn('[API Signup] listUsers failed:', listResult.rawError, '— trying generateLink workaround')

      // Fallback: use the generate_link admin API to get the user ID
      step = 'generate_link_lookup'
      const linkResult = await gotrueAdmin('POST', '/generate_link', {
        type: 'magiclink',
        email
      })
      if (linkResult.ok && linkResult.data?.id) {
        existingUserId = linkResult.data.id
        console.log('[API Signup] Found user via generate_link:', existingUserId)
      } else {
        console.error('[API Signup] generate_link also failed:', linkResult.rawError)
      }
    }

    if (!existingUserId) {
      return NextResponse.json(
        { success: false, error: 'An account with this email exists but we could not find it for cleanup. Please contact support.', code: 'lookup_failed', step },
        { status: 409 }
      )
    }

    // Step 4: Delete the remnant user
    step = 'delete_remnant'
    console.log('[API Signup] Deleting remnant user:', existingUserId)
    const deleteResult = await gotrueAdmin('DELETE', `/users/${existingUserId}`)

    if (!deleteResult.ok) {
      console.error('[API Signup] Delete failed:', deleteResult.rawError)
      return NextResponse.json(
        { success: false, error: `Could not remove old account: ${deleteResult.rawError}`, code: 'delete_failed', step },
        { status: 500 }
      )
    }

    console.log('[API Signup] Remnant deleted. Waiting before re-create...')
    await new Promise((r) => setTimeout(r, 1000))

    // Step 5: Retry create
    step = 'retry_create'
    console.log('[API Signup] Retrying createUser for:', email)
    const retryResult = await gotrueAdmin('POST', '/users', {
      email,
      password,
      email_confirm: true,
      user_metadata: metadata || {}
    })

    if (!retryResult.ok) {
      console.error('[API Signup] Retry createUser failed:', retryResult.rawError)
      return NextResponse.json(
        { success: false, error: `Account creation failed after cleanup: ${retryResult.rawError}`, code: 'retry_failed', step },
        { status: 500 }
      )
    }

    console.log('[API Signup] User created on retry:', retryResult.data?.id)
    return NextResponse.json({
      success: true,
      userId: retryResult.data?.id,
      email: retryResult.data?.email
    })
  } catch (error: any) {
    console.error('[API Signup] Unexpected error at step:', step, error?.message)
    return NextResponse.json(
      { success: false, error: `Server error at "${step}": ${error?.message || 'unknown'}`, code: 'server_error', step },
      { status: 500 }
    )
  }
}
