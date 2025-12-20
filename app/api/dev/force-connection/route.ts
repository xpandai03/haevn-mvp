import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * DEV ONLY: Force create a fully matched connection between two partnerships
 *
 * This creates a handshake with:
 * - a_consent = true
 * - b_consent = true
 * - state = 'matched'
 * - matched_at = now
 *
 * Use this to quickly create test connections without going through the full flow.
 */

interface HandshakeRow {
  id: string
  a_partnership: string
  b_partnership: string
  a_consent: boolean
  b_consent: boolean
  state: string
  match_score: number | null
  triggered_at: string
  matched_at: string | null
}

interface PartnershipRow {
  id: string
  display_name: string | null
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
      a_partnership_id,
      b_partnership_id,
      match_score = 85 // Default high score for test connections
    } = body

    // Validate input
    if (!a_partnership_id || !b_partnership_id) {
      return NextResponse.json(
        { error: 'Both partnership IDs are required' },
        { status: 400 }
      )
    }

    if (a_partnership_id === b_partnership_id) {
      return NextResponse.json(
        { error: 'Cannot create connection with same partnership' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to force connections' },
        { status: 401 }
      )
    }

    // Use service role for admin operations
    const adminSupabase = await createServiceRoleClient()

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
    const { data: partnershipsData, error: partnershipError } = await adminSupabase
      .from('partnerships')
      .select('id, display_name')
      .in('id', [a_partnership_id, b_partnership_id])

    const partnerships = partnershipsData as PartnershipRow[] | null

    if (partnershipError || !partnerships || partnerships.length !== 2) {
      return NextResponse.json(
        { error: 'One or both partnerships do not exist' },
        { status: 404 }
      )
    }

    // Create handshake with consistent ordering (smaller ID first)
    const orderedA = a_partnership_id < b_partnership_id ? a_partnership_id : b_partnership_id
    const orderedB = a_partnership_id < b_partnership_id ? b_partnership_id : a_partnership_id

    const now = new Date().toISOString()

    // Check if handshake already exists
    const { data: existingData } = await adminSupabase
      .from('handshakes')
      .select('*')
      .eq('a_partnership', orderedA)
      .eq('b_partnership', orderedB)
      .single()

    const existing = existingData as HandshakeRow | null

    if (existing) {
      // Update existing handshake to be a full match
      const { data: updatedData, error: updateError } = await adminSupabase
        .from('handshakes')
        .update({
          a_consent: true,
          b_consent: true,
          state: 'matched',
          match_score: match_score,
          matched_at: existing.matched_at || now
        } as never)
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      const updated = updatedData as HandshakeRow

      return NextResponse.json({
        success: true,
        message: 'Existing handshake updated to full connection',
        data: {
          handshake_id: updated.id,
          a_partnership: updated.a_partnership,
          b_partnership: updated.b_partnership,
          match_score: updated.match_score,
          matched_at: updated.matched_at,
          was_existing: true
        }
      })
    }

    // Create new fully matched handshake
    const { data: handshakeData, error: handshakeError } = await adminSupabase
      .from('handshakes')
      .insert({
        a_partnership: orderedA,
        b_partnership: orderedB,
        a_consent: true,
        b_consent: true,
        state: 'matched',
        match_score: match_score,
        triggered_at: now,
        matched_at: now
      } as never)
      .select()
      .single()

    if (handshakeError) {
      throw handshakeError
    }

    const handshake = handshakeData as HandshakeRow

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
      ] as never)
      .select()
    // Ignore errors as signals might already exist

    const partnershipA = partnerships.find(p => p.id === orderedA)
    const partnershipB = partnerships.find(p => p.id === orderedB)

    return NextResponse.json({
      success: true,
      message: 'Full connection created successfully',
      data: {
        handshake_id: handshake.id,
        a_partnership: {
          id: handshake.a_partnership,
          display_name: partnershipA?.display_name
        },
        b_partnership: {
          id: handshake.b_partnership,
          display_name: partnershipB?.display_name
        },
        match_score: handshake.match_score,
        matched_at: handshake.matched_at,
        was_existing: false
      }
    })

  } catch (error) {
    console.error('Error forcing connection:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create connection' },
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
    endpoint: '/api/dev/force-connection',
    method: 'POST',
    description: 'Force create a FULL mutual connection between two partnerships (DEV ONLY)',
    body: {
      a_partnership_id: 'UUID - First partnership ID (required)',
      b_partnership_id: 'UUID - Second partnership ID (required)',
      match_score: 'number - Compatibility score 0-100 (optional, default: 85)'
    },
    creates: {
      handshake: {
        a_consent: true,
        b_consent: true,
        state: 'matched',
        matched_at: 'current timestamp'
      },
      signals: 'Mutual signals between partnerships'
    },
    requirements: [
      'User must be authenticated',
      'User must be a member of at least one partnership',
      'Both partnerships must exist'
    ],
    note: 'If handshake already exists, it will be updated to a full connection'
  })
}
