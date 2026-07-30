'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import { derivePairState, type PairState } from '@/lib/connections/pairState'

/**
 * Viewer-relative accept state for every recommendation pair the viewer has
 * touched (proceeded, connected, or declined). The rec page looks up each card
 * by counterpart id; anything absent is 'none'. Read-only.
 *
 * SENDER PRIVACY: this returns only the VIEWER's derivable state. A counterpart's
 * decline is never represented — if the viewer proceeded and the counterpart
 * declined, this returns 'waiting', never 'declined'.
 */
export async function getRecAcceptStates(): Promise<Record<string, PairState>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const admin = createAdminClient()
  const selected = await selectBestPartnership(admin, user.id)
  if (!selected) return {}
  const viewerId = selected.partnership_id
  const nowIso = new Date().toISOString()

  const [{ data: signals }, { data: handshakes }, { data: hides }] = await Promise.all([
    admin
      .from('ready_to_meet_signals')
      .select('partnership_smaller, partnership_larger, signaller_partnership_id')
      .or(`partnership_smaller.eq.${viewerId},partnership_larger.eq.${viewerId}`),
    admin
      .from('handshakes')
      .select('a_partnership, b_partnership, a_consent, b_consent, state')
      .or(`a_partnership.eq.${viewerId},b_partnership.eq.${viewerId}`),
    admin
      .from('hidden_matches')
      .select('match_partnership_id')
      .eq('partnership_id', viewerId)
      .gt('expires_at', nowIso),
  ])

  // otherId -> set of signaller partnership ids for that pair
  const signallersByOther = new Map<string, Set<string>>()
  for (const s of signals || []) {
    const other = s.partnership_smaller === viewerId ? s.partnership_larger : s.partnership_smaller
    const set = signallersByOther.get(other) ?? new Set<string>()
    set.add(s.signaller_partnership_id)
    signallersByOther.set(other, set)
  }

  const handshakeMatchedOthers = new Set<string>()
  for (const h of handshakes || []) {
    if (h.a_consent && h.b_consent && h.state === 'matched') {
      handshakeMatchedOthers.add(h.a_partnership === viewerId ? h.b_partnership : h.a_partnership)
    }
  }

  const viewerHidOthers = new Set<string>((hides || []).map((r) => r.match_partnership_id))

  const others = new Set<string>([
    ...signallersByOther.keys(),
    ...handshakeMatchedOthers,
    ...viewerHidOthers,
  ])

  const out: Record<string, PairState> = {}
  for (const other of others) {
    out[other] = derivePairState({
      viewerId,
      counterpartId: other,
      signallers: signallersByOther.get(other) ?? new Set<string>(),
      viewerHidLive: viewerHidOthers.has(other),
      handshakeMatched: handshakeMatchedOthers.has(other),
      expired: false, // expired recs are already filtered from the list upstream
    })
  }
  return out
}
