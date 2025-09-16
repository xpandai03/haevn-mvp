import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Toggle private photo access grant for a handshake
export async function POST(request: NextRequest) {
  try {
    const { handshakeId, granted } = await request.json()

    if (!handshakeId || typeof granted !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // For development - update localStorage
    if (!process.env.SUPABASE_SERVICE_ROLE) {
      // This would be handled client-side in development
      return NextResponse.json({ success: true })
    }

    // Production: Use Supabase with service role
    const supabase = createServiceRoleClient()

    // Verify the user is part of this handshake
    const { data: handshake, error: handshakeError } = await supabase
      .from('handshakes')
      .select(`
        id,
        a_partnership,
        b_partnership,
        partnerships!a_partnership(owner_id),
        partnerships!b_partnership(owner_id)
      `)
      .eq('id', handshakeId)
      .single()

    if (handshakeError || !handshake) {
      return NextResponse.json(
        { error: 'Handshake not found' },
        { status: 404 }
      )
    }

    // TODO: Verify current user owns one of the partnerships
    // const { data: { user } } = await supabase.auth.getUser()
    // const isOwner =
    //   handshake.partnerships_a.owner_id === user?.id ||
    //   handshake.partnerships_b.owner_id === user?.id

    // if (!isOwner) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // }

    // Update or create grant
    const { error: grantError } = await supabase
      .from('photo_grants')
      .upsert({
        handshake_id: handshakeId,
        granted,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'handshake_id'
      })

    if (grantError) {
      console.error('Grant error:', grantError)
      return NextResponse.json(
        { error: 'Failed to update grant' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, granted })

  } catch (error) {
    console.error('Photo grant error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get grant status for a handshake
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const handshakeId = searchParams.get('handshakeId')

    if (!handshakeId) {
      return NextResponse.json(
        { error: 'Missing handshake ID' },
        { status: 400 }
      )
    }

    // For development
    if (!process.env.SUPABASE_SERVICE_ROLE) {
      return NextResponse.json({
        handshakeId,
        granted: false
      })
    }

    // Production: Check grant status
    const supabase = createServiceRoleClient()

    const { data: grant, error } = await supabase
      .from('photo_grants')
      .select('granted, updated_at')
      .eq('handshake_id', handshakeId)
      .single()

    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('Grant fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch grant' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      handshakeId,
      granted: grant?.granted || false,
      updatedAt: grant?.updated_at
    })

  } catch (error) {
    console.error('Photo grant error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}