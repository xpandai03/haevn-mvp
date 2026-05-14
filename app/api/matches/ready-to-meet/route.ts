import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import { canonicalPartnershipPair } from '@/lib/utils/partnershipPair'
import type { ReadyToMeetUiState } from '@/lib/types/readyToMeet'

function deriveState(
  viewerPartnershipId: string,
  otherPartnershipId: string,
  signallers: Set<string>
): ReadyToMeetUiState {
  const v = signallers.has(viewerPartnershipId)
  const o = signallers.has(otherPartnershipId)
  if (v && o) return 'mutual'
  if (v) return 'viewer_ready'
  return 'none'
}

async function loadSignallersForPair(
  admin: ReturnType<typeof createAdminClient>,
  viewerPartnershipId: string,
  otherPartnershipId: string
): Promise<Set<string>> {
  const { partnership_smaller: p1, partnership_larger: p2 } =
    canonicalPartnershipPair(viewerPartnershipId, otherPartnershipId)
  const { data, error } = await admin
    .from('ready_to_meet_signals')
    .select('signaller_partnership_id')
    .eq('partnership_smaller', p1)
    .eq('partnership_larger', p2)

  if (error) {
    console.error('[ready-to-meet] load signallers:', error.message)
    return new Set()
  }
  return new Set(
    (data || []).map((r: { signaller_partnership_id: string }) => r.signaller_partnership_id)
  )
}

/**
 * POST — record that the viewer's partnership is ready to meet the other.
 * GET — ?otherPartnershipId=… returns current UI state for that pair.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    let otherPartnershipId: string
    try {
      const body = await request.json()
      otherPartnershipId = body.otherPartnershipId
      if (!otherPartnershipId || typeof otherPartnershipId !== 'string') {
        return NextResponse.json(
          { success: false, error: 'otherPartnershipId required' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const admin = createAdminClient()
    const selected = await selectBestPartnership(admin, user.id)
    if (!selected) {
      return NextResponse.json({ success: false, error: 'No partnership' }, { status: 400 })
    }
    const viewerPartnershipId = selected.partnership_id

    if (otherPartnershipId === viewerPartnershipId) {
      return NextResponse.json({ success: false, error: 'Invalid pair' }, { status: 400 })
    }

    const { data: matchRows, error: matchErr } = await admin
      .from('computed_matches')
      .select('id')
      .or(
        `and(partnership_a.eq.${viewerPartnershipId},partnership_b.eq.${otherPartnershipId}),and(partnership_a.eq.${otherPartnershipId},partnership_b.eq.${viewerPartnershipId})`
      )
      .limit(1)

    if (matchErr || !matchRows?.length) {
      return NextResponse.json(
        { success: false, error: 'No match found for this pair' },
        { status: 404 }
      )
    }

    const { partnership_smaller, partnership_larger } = canonicalPartnershipPair(
      viewerPartnershipId,
      otherPartnershipId
    )

    const { error: insertErr } = await admin.from('ready_to_meet_signals').insert({
      partnership_smaller,
      partnership_larger,
      signaller_partnership_id: viewerPartnershipId,
    })

    if (insertErr) {
      if (insertErr.code !== '23505') {
        console.error('[ready-to-meet] insert:', insertErr)
        return NextResponse.json(
          { success: false, error: 'Could not save signal' },
          { status: 500 }
        )
      }
    }

    const signallers = await loadSignallersForPair(admin, viewerPartnershipId, otherPartnershipId)
    const state = deriveState(viewerPartnershipId, otherPartnershipId, signallers)

    return NextResponse.json({ success: true, state })
  } catch (e: unknown) {
    console.error('[ready-to-meet] POST', e)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const otherPartnershipId = request.nextUrl.searchParams.get('otherPartnershipId')
    if (!otherPartnershipId) {
      return NextResponse.json(
        { success: false, error: 'otherPartnershipId query required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createAdminClient()
    const selected = await selectBestPartnership(admin, user.id)
    if (!selected) {
      return NextResponse.json({ success: false, error: 'No partnership' }, { status: 400 })
    }
    const viewerPartnershipId = selected.partnership_id

    const signallers = await loadSignallersForPair(admin, viewerPartnershipId, otherPartnershipId)
    const state = deriveState(viewerPartnershipId, otherPartnershipId, signallers)

    return NextResponse.json({ success: true, state })
  } catch (e: unknown) {
    console.error('[ready-to-meet] GET', e)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
