import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

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
    const { a_partnership_id, b_partnership_id } = body

    // Validate input
    if (!a_partnership_id || !b_partnership_id) {
      return NextResponse.json(
        { error: 'Both partnership IDs are required' },
        { status: 400 }
      )
    }

    if (a_partnership_id === b_partnership_id) {
      return NextResponse.json(
        { error: 'Cannot create handshake with same partnership' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to force handshakes' },
        { status: 401 }
      )
    }

    // Use service role for admin operations
    const adminSupabase = createServiceRoleClient()

    // Verify user is a member of at least one partnership
    const { data: memberships, error: memberError } = await adminSupabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .in('partnership_id', [a_partnership_id, b_partnership_id])

    if (memberError || !memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'You must be a member of at least one of the partnerships' },
        { status: 403 }
      )
    }

    // Verify both partnerships exist
    const { data: partnerships, error: partnershipError } = await adminSupabase
      .from('partnerships')
      .select('id')
      .in('id', [a_partnership_id, b_partnership_id])

    if (partnershipError || !partnerships || partnerships.length !== 2) {
      return NextResponse.json(
        { error: 'One or both partnerships do not exist' },
        { status: 404 }
      )
    }

    // Create handshake with consistent ordering (smaller ID first)
    const orderedA = a_partnership_id < b_partnership_id ? a_partnership_id : b_partnership_id
    const orderedB = a_partnership_id < b_partnership_id ? b_partnership_id : a_partnership_id

    const { data: handshake, error: handshakeError } = await adminSupabase
      .from('handshakes')
      .insert({
        a_partnership: orderedA,
        b_partnership: orderedB
      })
      .select()
      .single()

    if (handshakeError) {
      // Check if handshake already exists
      if (handshakeError.code === '23505') { // Unique violation
        const { data: existing } = await adminSupabase
          .from('handshakes')
          .select()
          .eq('a_partnership', orderedA)
          .eq('b_partnership', orderedB)
          .single()

        return NextResponse.json({
          success: true,
          message: 'Handshake already exists',
          data: existing
        })
      }

      throw handshakeError
    }

    // Also create mutual signals for consistency
    await adminSupabase
      .from('signals')
      .insert([
        {
          from_partnership: a_partnership_id,
          to_partnership: b_partnership_id
        },
        {
          from_partnership: b_partnership_id,
          to_partnership: a_partnership_id
        }
      ])
      .select()
    // Ignore errors as signals might already exist

    return NextResponse.json({
      success: true,
      message: 'Handshake created successfully',
      data: {
        handshake_id: handshake.id,
        a_partnership: handshake.a_partnership,
        b_partnership: handshake.b_partnership,
        created_at: handshake.created_at
      }
    })

  } catch (error) {
    console.error('Error forcing handshake:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create handshake' },
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
    endpoint: '/api/dev/force-handshake',
    method: 'POST',
    description: 'Force create a handshake between two partnerships (DEV ONLY)',
    body: {
      a_partnership_id: 'UUID - First partnership ID',
      b_partnership_id: 'UUID - Second partnership ID'
    },
    requirements: [
      'User must be authenticated',
      'User must be a member of at least one partnership',
      'Both partnerships must exist'
    ],
    note: 'Also creates mutual signals for consistency'
  })
}