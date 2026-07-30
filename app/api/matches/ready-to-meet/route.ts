import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import { canonicalPartnershipPair } from '@/lib/utils/partnershipPair'
import { sendNotification, buildSignInUrl } from '@/lib/services/notifications'
import { decideProceedSideEffect } from '@/lib/connections/pairState'
import type { ReadyToMeetUiState } from '@/lib/types/readyToMeet'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Ready-to-meet / recommendation-proceed signal.
 *
 * BACKWARD COMPATIBLE: a POST with no `band` (the matches-page ReadyToMeetButton)
 * behaves EXACTLY as before — insert the signal, return the RTM UI state. Only a
 * POST with `band: 'rec'` (the recommendations surface) unlocks the accept-flow
 * side effects: notify the counterpart once on the first proceed, and create the
 * handshake once on the mutual proceed. Matches keep RTM as a pure signal (their
 * connection is made via the separate handshake flow), so match behavior is
 * untouched.
 */

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
  admin: Admin,
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
  return new Set((data || []).map((r: { signaller_partnership_id: string }) => r.signaller_partnership_id))
}

/** Pair validity: exists in current computed_matches OR retained match_history. */
async function loadPairValidity(
  admin: Admin,
  a: string,
  b: string
): Promise<{ exists: boolean; expired: boolean; score: number | null }> {
  const pairOr = `and(partnership_a.eq.${a},partnership_b.eq.${b}),and(partnership_a.eq.${b},partnership_b.eq.${a})`
  const [{ data: cmRows }, { data: mhRows }] = await Promise.all([
    admin.from('computed_matches').select('score, expires_at').or(pairOr).limit(1),
    admin.from('match_history').select('score').or(pairOr).limit(1),
  ])
  const cm = cmRows?.[0] as { score: number | null; expires_at: string | null } | undefined
  const mh = mhRows?.[0] as { score: number | null } | undefined
  if (!cm && !mh) return { exists: false, expired: false, score: null }
  const now = Date.now()
  const cmLive = !!cm && (!cm.expires_at || Date.parse(cm.expires_at) > now)
  const expired = !cmLive && !mh // current row lapsed AND not retained in history
  return { exists: true, expired, score: cm?.score ?? mh?.score ?? null }
}

/** Viewer has a live (non-expired) hide of the counterpart → their own decline. */
async function viewerHasLiveHide(admin: Admin, viewerId: string, counterpartId: string): Promise<boolean> {
  const { data } = await admin
    .from('hidden_matches')
    .select('id')
    .eq('partnership_id', viewerId)
    .eq('match_partnership_id', counterpartId)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
  return !!data?.length
}

/** Fire the blind "someone is open to connecting" notification. Fire-and-forget. */
async function notifyCounterpart(admin: Admin, counterpartId: string): Promise<void> {
  try {
    const { data: cp } = await admin.from('partnerships').select('phone').eq('id', counterpartId).maybeSingle()
    const { data: mem } = await admin
      .from('partnership_members').select('user_id').eq('partnership_id', counterpartId).limit(1).maybeSingle()
    let email: string | null = null
    if (mem?.user_id) {
      const { data: au } = await admin.auth.admin.getUserById(mem.user_id)
      email = au?.user?.email ?? null
    }
    const signInUrl = email ? await buildSignInUrl(email) : null
    // sendNotification logs to system_events (notification_sent) and never throws.
    await sendNotification({
      type: 'connection_interest',
      phone: (cp as { phone?: string | null } | null)?.phone ?? null,
      email,
      signInUrl: signInUrl ?? undefined,
      partnershipId: counterpartId,
    })
  } catch (e) {
    console.error('[ready-to-meet] notifyCounterpart failed (non-fatal):', e)
  }
}

/** Create the mutual-connection handshake exactly once. Idempotent; blocked if either side has a live hide. */
async function ensureHandshake(admin: Admin, viewerId: string, otherId: string, score: number | null): Promise<void> {
  const { partnership_smaller: smaller, partnership_larger: larger } = canonicalPartnershipPair(viewerId, otherId)
  const nowIso = new Date().toISOString()
  // A live hide on EITHER side blocks connection creation.
  const { data: hides } = await admin
    .from('hidden_matches')
    .select('id')
    .or(`and(partnership_id.eq.${smaller},match_partnership_id.eq.${larger}),and(partnership_id.eq.${larger},match_partnership_id.eq.${smaller})`)
    .gt('expires_at', nowIso)
    .limit(1)
  if (hides?.length) return
  // Idempotency: one handshake per pair.
  const { data: existing } = await admin
    .from('handshakes')
    .select('id')
    .or(`and(a_partnership.eq.${smaller},b_partnership.eq.${larger}),and(a_partnership.eq.${larger},b_partnership.eq.${smaller})`)
    .limit(1)
  if (existing?.length) return
  const { error } = await admin.from('handshakes').insert({
    a_partnership: smaller, // canonical order satisfies handshakes CHECK(a < b)
    b_partnership: larger,
    a_consent: true,
    b_consent: true,
    state: 'matched',
    match_score: score,
    triggered_at: nowIso,
    matched_at: nowIso,
  })
  if (error && error.code !== '23505') {
    console.error('[ready-to-meet] ensureHandshake insert:', error.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    let otherPartnershipId: string
    let band: 'rec' | 'match' | null = null
    try {
      const body = await request.json()
      otherPartnershipId = body.otherPartnershipId
      if (!otherPartnershipId || typeof otherPartnershipId !== 'string') {
        return NextResponse.json({ success: false, error: 'otherPartnershipId required' }, { status: 400 })
      }
      if (body.band === 'rec' || body.band === 'match') band = body.band
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

    const validity = await loadPairValidity(admin, viewerPartnershipId, otherPartnershipId)
    if (!validity.exists) {
      return NextResponse.json({ success: false, error: 'No match found for this pair' }, { status: 404 })
    }

    // Rec-flow guards (matches path skips these to stay behavior-identical).
    if (band === 'rec') {
      if (validity.expired) {
        return NextResponse.json({ success: false, error: 'expired', state: 'none' }, { status: 409 })
      }
      if (await viewerHasLiveHide(admin, viewerPartnershipId, otherPartnershipId)) {
        // proceed-after-your-own-decline is rejected
        return NextResponse.json({ success: false, error: 'declined', state: 'none' }, { status: 409 })
      }
    }

    const { partnership_smaller, partnership_larger } =
      canonicalPartnershipPair(viewerPartnershipId, otherPartnershipId)

    const { error: insertErr } = await admin.from('ready_to_meet_signals').insert({
      partnership_smaller,
      partnership_larger,
      signaller_partnership_id: viewerPartnershipId,
      band_at_signal: band, // NULL for the matches button → unchanged behavior
    })

    const isDuplicate = insertErr?.code === '23505'
    if (insertErr && !isDuplicate) {
      console.error('[ready-to-meet] insert:', insertErr)
      return NextResponse.json({ success: false, error: 'Could not save signal' }, { status: 500 })
    }

    const signallers = await loadSignallersForPair(admin, viewerPartnershipId, otherPartnershipId)

    // Exactly-once side effects — matches skip, retries skip (see decideProceedSideEffect).
    const effect = decideProceedSideEffect({
      band,
      isDuplicate,
      signallersAfter: signallers,
      viewerId: viewerPartnershipId,
      counterpartId: otherPartnershipId,
    })
    if (effect === 'notify_counterpart') {
      // Only the first-ever signal for the pair reaches here fresh.
      await notifyCounterpart(admin, otherPartnershipId)
    } else if (effect === 'create_handshake') {
      // Mutual: create the connection exactly once (idempotent).
      await ensureHandshake(admin, viewerPartnershipId, otherPartnershipId, validity.score)
    }

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
      return NextResponse.json({ success: false, error: 'otherPartnershipId query required' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
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
