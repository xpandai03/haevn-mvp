import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * DEV ONLY: Force create a nudge between two users
 *
 * Use this to quickly create test nudges without membership checks.
 */

interface NudgeRow {
  id: string
  sender_id: string
  recipient_id: string
  created_at: string
  read_at: string | null
}

interface ProfileRow {
  user_id: string
  full_name: string | null
}

export async function POST(request: NextRequest) {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const {
      sender_id,
      recipient_id,
      mark_as_read = false
    } = body

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to force nudges' },
        { status: 401 }
      )
    }

    // Use service role for admin operations
    const adminSupabase = await createServiceRoleClient()

    // Determine sender and recipient
    // If not provided, use current user as one of them
    const actualSenderId = sender_id || user.id
    const actualRecipientId = recipient_id

    if (!actualRecipientId) {
      return NextResponse.json(
        { error: 'recipient_id is required' },
        { status: 400 }
      )
    }

    if (actualSenderId === actualRecipientId) {
      return NextResponse.json(
        { error: 'Cannot nudge yourself' },
        { status: 400 }
      )
    }

    // Verify both users exist
    const { data: usersData, error: usersError } = await adminSupabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', [actualSenderId, actualRecipientId])

    const users = usersData as ProfileRow[] | null

    if (usersError || !users || users.length !== 2) {
      return NextResponse.json(
        { error: 'One or both users do not exist (no profile found)' },
        { status: 404 }
      )
    }

    // Check if nudge already exists
    const { data: existingData } = await adminSupabase
      .from('nudges')
      .select('*')
      .eq('sender_id', actualSenderId)
      .eq('recipient_id', actualRecipientId)
      .single()

    const existing = existingData as NudgeRow | null

    if (existing) {
      // Optionally update read status
      if (mark_as_read && !existing.read_at) {
        const { data: updatedData } = await adminSupabase
          .from('nudges')
          .update({ read_at: new Date().toISOString() } as never)
          .eq('id', existing.id)
          .select()
          .single()

        return NextResponse.json({
          success: true,
          message: 'Existing nudge marked as read',
          data: updatedData
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Nudge already exists',
        data: existing
      })
    }

    // Create new nudge
    const { data: nudgeData, error: nudgeError } = await adminSupabase
      .from('nudges')
      .insert({
        sender_id: actualSenderId,
        recipient_id: actualRecipientId,
        read_at: mark_as_read ? new Date().toISOString() : null
      } as never)
      .select()
      .single()

    if (nudgeError) {
      throw nudgeError
    }

    const nudge = nudgeData as NudgeRow

    const senderProfile = users.find(u => u.user_id === actualSenderId)
    const recipientProfile = users.find(u => u.user_id === actualRecipientId)

    return NextResponse.json({
      success: true,
      message: 'Nudge created successfully',
      data: {
        nudge_id: nudge.id,
        sender: {
          id: actualSenderId,
          name: senderProfile?.full_name
        },
        recipient: {
          id: actualRecipientId,
          name: recipientProfile?.full_name
        },
        created_at: nudge.created_at,
        is_read: !!nudge.read_at
      }
    })

  } catch (error) {
    console.error('Error forcing nudge:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create nudge' },
      { status: 500 }
    )
  }
}

// Document the endpoint
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    endpoint: '/api/dev/force-nudge',
    method: 'POST',
    description: 'Force create a nudge between two users (DEV ONLY, bypasses membership check)',
    body: {
      sender_id: 'UUID - Sender user ID (optional, defaults to current user)',
      recipient_id: 'UUID - Recipient user ID (required)',
      mark_as_read: 'boolean - Mark nudge as read immediately (optional, default: false)'
    },
    requirements: [
      'User must be authenticated',
      'Both sender and recipient must have profiles'
    ],
    note: 'If nudge already exists, returns existing nudge (can update read status)'
  })
}
