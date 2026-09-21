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
import { matchReportV2Enabled } from './reportFlag'
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
  /** Profile-at-a-Glance fields, individually. The card renders them joined as
   *  `demographics`; the report renders them as labelled columns, and a null
   *  field renders NOTHING rather than "Unknown". */
  gender: string | null
  orientation: string | null
  structure: string | null
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
  /** True when the v2 report document should render instead of the expansion. */
  reportV2: boolean
  /** Viewer's own city — powers the same-city / cross-city location line. */
  viewerCity: string | null
  /** Veriff-confirmed. The report's trust badge renders only when true. */
  matchVerified: boolean
  /**
   * v2 only. True when no usable interpretation is cached yet, so the document
   * renders its "being prepared" state for the AI fields while generation runs
   * in the background. Never set on the v1 path.
   */
  interpretationPending: boolean
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
    gender: p.gender ?? null,
    orientation: p.sexuality ?? null,
    structure: p.relationship_structure ?? null,
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

  const v2 = matchReportV2Enabled()

  // v1 keeps generating on demand — a ~12s render, but changing it would not be
  // byte-identical with the flag off, and that is the harder requirement.
  // v2 reads CACHE ONLY so the document paints immediately; generation is kicked
  // off separately by ensureMatchInterpretation() and picked up on refresh.
  const interp = await getMatchInterpretation(admin, viewer, matchId, v2 ? { cacheOnly: true } : {})

  const { data: viewerRow } = await admin.from('partnerships').select('city').eq('id', viewer).maybeSingle()

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
    reportV2: v2,
    viewerCity: (viewerRow as { city?: string | null } | null)?.city ?? null,
    matchVerified: card.partnership.is_verified === true,
    interpretationPending: v2 && !interp.payload,
  }
}

/**
 * Fire-and-forget generation for the v2 document.
 *
 * Generation is synchronous and measured at ~11–14s. Blocking the report render
 * on it would mean a member staring at a spinner for the length of a lift ride,
 * on a page whose scores, bands and static copy are all available instantly. So
 * the document paints, this runs behind it, and a refresh picks up the prose.
 *
 * Returns whether a payload now exists so the client can decide to re-fetch
 * rather than poll blindly. Never throws — a failure leaves the prepared state
 * on screen, which is the same thing the member already sees.
 */
export async function ensureMatchInterpretation(matchId: string): Promise<{ ready: boolean }> {
  try {
    const viewer = await resolveViewerPartnershipId()
    if (!viewer) return { ready: false }
    const admin = createAdminClient()
    const r = await getMatchInterpretation(admin, viewer, matchId)
    return { ready: !!r.payload }
  } catch {
    return { ready: false }
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
