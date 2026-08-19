'use server'

/**
 * Server data for the redesigned match surfaces.
 *
 *  - getMatchBreakdownData(matchId): everything the EXPANDED breakdown route needs
 *    for one match — sections, on-demand AI interpretation (generate + cache),
 *    card state, overall badge, and the already-server-redacted identity.
 *  - getCardInterpretations(ids): a fast, cache-ONLY batch for the card list, so a
 *    list render never blocks on generation (cards fall back to deterministic copy
 *    until the warm pass / a breakdown view fills the cache).
 *
 * Redaction is inherited from getComputedMatchCards (server-side, PR-A) — this
 * layer never re-exposes name/photo for free viewers.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import { getComputedMatchCards, type ComputedMatchCard } from '@/lib/actions/computedMatchCards'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { getMatchInterpretation } from './getMatchInterpretation'
import { hasMatchNudgedViewer } from './nudgeState'
import { overallBadge, type Band, type Section } from './sectionMapping'
import type { MatchInterpretation } from '@/lib/ai/matchInterpretationSchema'

async function resolveViewerPartnershipId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const sel = await selectBestPartnership(createAdminClient(), user.id)
  return sel?.partnership_id ?? null
}

export type CardState = 'standard' | 'nudged' | 'unlocked'

export interface CardIdentity {
  /** Free viewers: the redacted token ("D***") only. */
  nameToken: string
  /** Paid viewers only — real name (null for free). */
  displayName: string | null
  age: number
  /** Real photo URL when entitled; null for free (silhouette). */
  photoUrl: string | null
  demographics: string | null
  distanceMiles?: number
  city: string
}

export interface MatchBreakdownData {
  matchId: string
  matchScore: number
  type: 'match' | 'recommendation'
  state: CardState
  badge: { band: Band; label: string }
  identity: CardIdentity
  sections: Section[]
  interpretation: MatchInterpretation | null
  degraded: boolean
}

function demographicsLine(p: ComputedMatchCard['partnership']): string | null {
  const parts: string[] = []
  if (p.gender?.trim()) parts.push(p.gender.trim())
  if (p.sexuality?.trim()) parts.push(p.sexuality.trim())
  if (p.relationship_structure?.trim()) parts.push(p.relationship_structure.trim())
  if (p.distance_miles != null && p.distance_miles >= 0) parts.push(`${p.distance_miles} miles away`)
  else if (p.city?.trim()) parts.push(p.city.trim())
  return parts.length ? parts.join(' · ') : null
}

function identityOf(card: ComputedMatchCard): CardIdentity {
  const p = card.partnership
  return {
    nameToken: p.first_name || '—',
    displayName: p.display_name,
    age: p.age,
    photoUrl: p.photo_url ?? null,
    demographics: demographicsLine(p),
    distanceMiles: p.distance_miles,
    city: p.city,
  }
}

/** All released cards for the viewer (matches ≥80 + recs 77–79), redacted. */
async function findViewerCard(matchId: string): Promise<ComputedMatchCard | undefined> {
  const cards = await getComputedMatchCards('Bronze', 100, { minScore: 77 })
  return cards.find((c) => c.partnership.id === matchId)
}

export async function getMatchBreakdownData(matchId: string): Promise<MatchBreakdownData | null> {
  const viewer = await resolveViewerPartnershipId()
  if (!viewer) return null
  const card = await findViewerCard(matchId)
  if (!card) return null

  const tier = await getUserMembershipTier()
  const isFree = tier === 'free'
  const admin = createAdminClient()
  const nudged = isFree ? await hasMatchNudgedViewer(admin, viewer, matchId) : false
  const state: CardState = !isFree ? 'unlocked' : nudged ? 'nudged' : 'standard'

  // Breakdown = single match → generate on demand (cache-fills for next time).
  const interp = await getMatchInterpretation(admin, viewer, matchId)

  return {
    matchId,
    matchScore: card.score,
    type: card.score >= 80 ? 'match' : 'recommendation',
    state,
    badge: overallBadge(card.score),
    identity: identityOf(card),
    sections: card.sections,
    interpretation: interp.payload,
    degraded: interp.degraded,
  }
}

/** Cache-only interpretations for a list of match ids (never blocks on generation). */
export async function getCardInterpretations(matchIds: string[]): Promise<Record<string, MatchInterpretation | null>> {
  const viewer = await resolveViewerPartnershipId()
  if (!viewer) return {}
  const admin = createAdminClient()
  const out: Record<string, MatchInterpretation | null> = {}
  await Promise.all(
    matchIds.map(async (id) => {
      const r = await getMatchInterpretation(admin, viewer, id, { cacheOnly: true })
      out[id] = r.payload
    })
  )
  return out
}
