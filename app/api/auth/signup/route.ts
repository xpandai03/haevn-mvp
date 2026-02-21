import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/signup
 *
 * Server-side signup fallback that uses the Supabase admin API.
 * Used when the client-side supabase.auth.signUp() fails (e.g. GoTrue
 * returns empty/malformed responses for previously-deleted users).
 *
 * This route:
 * 1. Checks if a user with the given email already exists in auth.users
 * 2. If so, deletes the remnant user (handles incomplete deletions)
 * 3. Creates the user via auth.admin.createUser() which bypasses GoTrue
 *    edge cases
 * 4. Returns the new user data as JSON
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, metadata } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Check for existing user with this email (remnants from incomplete deletion)
    console.log('[API Signup] Checking for existing user:', email)
    const { data: listData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })

    const existingUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (existingUser) {
      console.log('[API Signup] Found existing user remnant:', existingUser.id)
      console.log('[API Signup] Identities:', existingUser.identities?.length)
      console.log('[API Signup] Created at:', existingUser.created_at)

      // Delete the remnant user so we can re-create cleanly
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(
        existingUser.id
      )

      if (deleteError) {
        console.error('[API Signup] Failed to delete remnant user:', deleteError)
        return NextResponse.json(
          {
            success: false,
            error: 'An account with this email exists but could not be reset. Please contact support.',
            code: 'delete_failed'
          },
          { status: 409 }
        )
      }

      console.log('[API Signup] Deleted remnant user successfully')

      // Brief pause to let Supabase propagate the deletion
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Create user via admin API (bypasses GoTrue client-side edge cases)
    console.log('[API Signup] Creating user via admin API:', email)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since this is a fallback path
      user_metadata: metadata || {}
    })

    if (createError) {
      console.error('[API Signup] Admin createUser failed:', createError)
      return NextResponse.json(
        {
          success: false,
          error: createError.message || 'Failed to create account',
          code: 'create_failed'
        },
        { status: 500 }
      )
    }

    console.log('[API Signup] User created successfully:', newUser.user?.id)

    return NextResponse.json({
      success: true,
      userId: newUser.user?.id,
      email: newUser.user?.email
    })
  } catch (error: any) {
    console.error('[API Signup] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during signup. Please try again.',
        code: 'server_error'
      },
      { status: 500 }
    )
  }
}
