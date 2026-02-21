import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/signup
 *
 * Server-side signup using the Supabase service-role client (same one
 * used by /api/dev/seed and /api/health/supabase).
 *
 * Flow:
 * 1. Try auth.admin.createUser() directly
 * 2. If user already exists → delete remnant, retry
 * 3. Always return JSON
 */
export async function POST(request: Request) {
  let step = 'init'
  try {
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

    // Use the same service-role client that works in seed/health routes
    step = 'create_client'
    const supabase = await createServiceRoleClient()

    // Step 1: Try to create the user directly via admin API
    step = 'create_user'
    console.log('[API Signup] Creating user via admin API:', email)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata || {}
    })

    // Happy path — user created successfully
    if (!createError && newUser?.user) {
      console.log('[API Signup] User created:', newUser.user.id)
      return NextResponse.json({
        success: true,
        userId: newUser.user.id,
        email: newUser.user.email
      })
    }

    // If the error is NOT "already exists", return it
    const errMsg = (createError?.message || '').toLowerCase()
    console.error('[API Signup] createUser error:', createError?.message, 'status:', createError?.status)

    const isAlreadyExists =
      errMsg.includes('already') ||
      errMsg.includes('exists') ||
      errMsg.includes('registered') ||
      errMsg.includes('duplicate') ||
      createError?.status === 422

    if (!isAlreadyExists) {
      return NextResponse.json(
        { success: false, error: `Account creation failed: ${createError?.message || 'Unknown error'}`, code: 'create_failed', step },
        { status: 500 }
      )
    }

    // Step 2: User already exists — find them
    step = 'find_existing'
    console.log('[API Signup] User may already exist. Listing users to find:', email)
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (listError) {
      console.error('[API Signup] listUsers error:', listError.message)
      return NextResponse.json(
        { success: false, error: `Cannot look up existing account: ${listError.message}`, code: 'list_failed', step },
        { status: 500 }
      )
    }

    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!existingUser) {
      console.error('[API Signup] User "already exists" but not found in listUsers')
      return NextResponse.json(
        { success: false, error: 'Account conflict — user reported as existing but not found. Please contact support.', code: 'ghost_user', step },
        { status: 409 }
      )
    }

    // Step 3: Delete the remnant user
    step = 'delete_remnant'
    console.log('[API Signup] Deleting remnant user:', existingUser.id, 'identities:', existingUser.identities?.length)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id)

    if (deleteError) {
      console.error('[API Signup] deleteUser error:', deleteError.message)
      return NextResponse.json(
        { success: false, error: `Could not remove old account: ${deleteError.message}`, code: 'delete_failed', step },
        { status: 500 }
      )
    }

    console.log('[API Signup] Remnant deleted. Waiting 1s...')
    await new Promise((r) => setTimeout(r, 1000))

    // Step 4: Retry user creation
    step = 'retry_create'
    console.log('[API Signup] Retrying createUser for:', email)
    const { data: retryUser, error: retryError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata || {}
    })

    if (retryError || !retryUser?.user) {
      console.error('[API Signup] Retry createUser error:', retryError?.message)
      return NextResponse.json(
        { success: false, error: `Account creation failed after cleanup: ${retryError?.message || 'Unknown error'}`, code: 'retry_failed', step },
        { status: 500 }
      )
    }

    console.log('[API Signup] User created on retry:', retryUser.user.id)
    return NextResponse.json({
      success: true,
      userId: retryUser.user.id,
      email: retryUser.user.email
    })
  } catch (error: any) {
    console.error('[API Signup] Unexpected error at step:', step, error?.message)
    return NextResponse.json(
      { success: false, error: `Server error at "${step}": ${error?.message || 'unknown'}`, code: 'server_error', step },
      { status: 500 }
    )
  }
}
