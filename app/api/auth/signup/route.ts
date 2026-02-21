import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/signup
 *
 * Server-side signup using the Supabase admin API.
 * Handles edge cases like previously-deleted users by cleaning up
 * remnants and creating the user via auth.admin.createUser().
 */
export async function POST(request: Request) {
  let step = 'init'
  try {
    step = 'parse_body'
    const body = await request.json()
    const { email, password, metadata } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required', step },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters', step },
        { status: 400 }
      )
    }

    step = 'create_admin_client'
    let adminClient: ReturnType<typeof createAdminClient>
    try {
      adminClient = createAdminClient()
    } catch (e: any) {
      console.error('[API Signup] Failed to create admin client:', e.message)
      return NextResponse.json(
        { success: false, error: 'Server configuration error (admin client).', code: 'config_error', step },
        { status: 500 }
      )
    }

    // Check for existing user with this email (remnants from incomplete deletion)
    step = 'list_users'
    console.log('[API Signup] Checking for existing user:', email)
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    if (listError) {
      console.error('[API Signup] listUsers failed:', listError)
      return NextResponse.json(
        { success: false, error: `Failed to check existing users: ${listError.message}`, code: 'list_error', step },
        { status: 500 }
      )
    }

    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (existingUser) {
      step = 'delete_remnant'
      console.log('[API Signup] Found existing user:', existingUser.id, 'identities:', existingUser.identities?.length, 'created:', existingUser.created_at)

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(
        existingUser.id
      )

      if (deleteError) {
        console.error('[API Signup] Failed to delete remnant user:', deleteError)
        return NextResponse.json(
          { success: false, error: `Account exists but cleanup failed: ${deleteError.message}`, code: 'delete_failed', step },
          { status: 409 }
        )
      }

      console.log('[API Signup] Deleted remnant user successfully')
      // Brief pause to let Supabase propagate the deletion
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } else {
      console.log('[API Signup] No existing user found for:', email)
    }

    // Create user via admin API
    step = 'create_user'
    console.log('[API Signup] Creating user via admin API:', email)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata || {}
    })

    if (createError) {
      console.error('[API Signup] createUser failed:', createError.message, createError)
      return NextResponse.json(
        { success: false, error: `Account creation failed: ${createError.message}`, code: 'create_failed', step },
        { status: 500 }
      )
    }

    console.log('[API Signup] User created:', newUser.user?.id, newUser.user?.email)

    return NextResponse.json({
      success: true,
      userId: newUser.user?.id,
      email: newUser.user?.email
    })
  } catch (error: any) {
    console.error('[API Signup] Unexpected error at step:', step, error?.message, error)
    return NextResponse.json(
      {
        success: false,
        error: `Unexpected server error at step "${step}": ${error?.message || 'unknown'}`,
        code: 'server_error',
        step
      },
      { status: 500 }
    )
  }
}
