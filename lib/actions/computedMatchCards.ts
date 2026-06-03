'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import {
  firstNameFromDisplayName,
  computeAgeFromBirthRaw,
  relationshipStylesFromSurveyAnswers,
  haversineMiles,
} from '@/lib/utils/matchCardDisplay'
import { canonicalPartnershipPair } from '@/lib/utils/partnershipPair'
import { getHiddenMatchIds } from '@/lib/actions/hiddenMatches'
import type { ReadyToMeetUiState } from '@/lib/types/readyToMeet'

// =============================================================================
// TYPES
// =============================================================================

export interface ComputedMatchCard {
  partnership: {
    id: string
    display_name: string | null
    short_bio: string | null
    connection_summary?: string | null
    identity: string
    city: string
    age: number
    photo_url?: string
    membership_tier: 'free' | 'plus'
    /** Derived for cards — not a DB column */
    first_name: string
    gender: string | null
    sexuality: string | null
    relationship_structure: string | null
    /** Rounded road miles when both partnerships have coordinates */
    distance_miles?: number
  }
  score: number
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  /** Category breakdown keyed by display key (goals_expectations, etc.) */
  breakdown: Record<string, { score: number }>
  /** Whether this match has been saved for later */
  saved: boolean
  /** Mutual "ready to meet" signal (see ready_to_meet_signals). */
  readyToMeet: ReadyToMeetUiState
  /** Handshake/connection status with this match (drives card actions). */
  connection: {
    status: 'none' | 'pending' | 'connected'
    handshakeId: string | null
  }
}

/**
 * Map engine category names to MatchProfileView display keys.
 */
const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  intent: 'goals_expectations',
  structure: 'structure_fit',
  connection: 'boundaries_comfort',
  lifestyle: 'openness_curiosity',
  chemistry: 'sexual_energy',
}

// =============================================================================
// HELPERS
// =============================================================================

/** Must match dashboard / connections — users with multiple partnerships get one active row. */
async function getCurrentPartnershipId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const adminClient = createAdminClient()
  const selected = await selectBestPartnership(adminClient, user.id)
  if (!selected) {
    throw new Error('No partnership found for user')
  }
  return selected.partnership_id
}

/**
 * Parse the engine's category breakdown (stored as array) into display keys.
 */
function parseOrientationValue(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const v = (raw as { value?: unknown }).value
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function parseBreakdown(raw: any): Record<string, { score: number }> {
  const sections: Record<string, { score: number }> = {}
  if (!raw) return sections

  // breakdown is stored as CategoryScore[] from the engine
  const categories = Array.isArray(raw) ? raw : []
  for (const cat of categories) {
    const displayKey = CATEGORY_DISPLAY_MAP[cat.category] || cat.category
    sections[displayKey] = { score: Math.round(cat.score ?? 0) }
  }

  return sections
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Fetch precomputed match cards from computed_matches table.
 *
 * This is the ONLY data source for match display in the UI.
 * No dynamic recomputation — reads what computeMatchesForPartnership() stored.
 *
 * @param minTier - Minimum tier to include (default: 'Bronze')
 * @param limit - Maximum number of matches to return (default: 50)
 */
export async function getComputedMatchCards(
  minTier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze' = 'Bronze',
  limit: number = 50
): Promise<ComputedMatchCard[]> {
  const adminClient = createAdminClient()
  const currentPartnershipId = await getCurrentPartnershipId()

  // 0. Gate: only show matches if user is in a live market
  const authClient = await createClient()
  const { data: { user: authUser } } = await authClient.auth.getUser()
  if (authUser) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('msa_status')
      .eq('user_id', authUser.id)
      .single()
    // Only explicit waitlist blocks; 'live' and legacy null still see matches
    if (profile?.msa_status === 'waitlist') {
      return []
    }
  }

  // 1. Fetch computed matches for this partnership (bidirectional)
  //    Filter by release_at (Match Monday) and expires_at (90-day expiry)
  const now = new Date().toISOString()
  const { data: matches, error: matchError } = await adminClient
    .from('computed_matches')
    .select('partnership_a, partnership_b, score, tier, breakdown, release_at, expires_at, saved')
    .or(`partnership_a.eq.${currentPartnershipId},partnership_b.eq.${currentPartnershipId}`)
    .order('score', { ascending: false })
    .limit(limit * 2) // Fetch extra since we have bidirectional rows

  if (matchError || !matches || matches.length === 0) {
    if (matchError) console.error('[getComputedMatchCards] Query error:', matchError)
    return []
  }

  // 1b. Fetch all handshakes involving the viewer — derive dismissed set
  //     (for exclusion) and a connection-status map (for card actions).
  const { data: viewerHandshakes } = await adminClient
    .from('handshakes')
    .select('id, a_partnership, b_partnership, a_consent, b_consent, state')
    .or(`a_partnership.eq.${currentPartnershipId},b_partnership.eq.${currentPartnershipId}`)

  const dismissedIds = new Set<string>()
  const connectionMap = new Map<
    string,
    { status: 'none' | 'pending' | 'connected'; handshakeId: string | null }
  >()
  if (viewerHandshakes) {
    for (const h of viewerHandshakes) {
      const otherId =
        h.a_partnership === currentPartnershipId
          ? h.b_partnership
          : h.a_partnership
      if (h.state === 'dismissed') {
        dismissedIds.add(otherId)
        continue
      }
      const connected =
        h.a_consent && h.b_consent && h.state === 'matched'
      connectionMap.set(otherId, {
        status: connected ? 'connected' : 'pending',
        handshakeId: h.id,
      })
    }
  }

  // 1c. Fetch hidden (passed) matches still within their 30-day window for exclusion
  const hiddenIds = await getHiddenMatchIds(currentPartnershipId)

  // 2. Deduplicate — keep only rows where we can identify the "other" partnership
  //    and filter by minimum tier, release_at, expires_at, and dismissed status
  const tierOrder = ['Platinum', 'Gold', 'Silver', 'Bronze'] as const
  const minTierIndex = tierOrder.indexOf(minTier)
  const seenPartnerIds = new Set<string>()

  const filteredMatches: Array<{
    otherPartnerId: string
    score: number
    tier: string
    breakdown: any
    saved: boolean
  }> = []

  for (const m of matches) {
    const otherId = m.partnership_a === currentPartnershipId
      ? m.partnership_b
      : m.partnership_a

    // Deduplicate
    if (seenPartnerIds.has(otherId)) continue
    seenPartnerIds.add(otherId)

    // Filter out dismissed matches
    if (dismissedIds.has(otherId)) continue

    // Filter out hidden (passed) matches within the 30-day window
    if (hiddenIds.has(otherId)) continue

    // Filter by release_at (Match Monday) — only show if released or no release_at set
    if (m.release_at && m.release_at > now) continue

    // Filter by expires_at (90-day expiry) — saved matches bypass expiration
    if (!m.saved && m.expires_at && m.expires_at <= now) continue

    // Filter by tier
    const resultTierIndex = tierOrder.indexOf(m.tier as any)
    if (resultTierIndex === -1 || resultTierIndex > minTierIndex) continue

    filteredMatches.push({
      otherPartnerId: otherId,
      score: m.score,
      tier: m.tier,
      breakdown: m.breakdown,
      saved: !!m.saved,
    })
  }

  if (filteredMatches.length === 0) return []

  // 3. Fetch partner profile data in one query (+ geo + JSON for card demographics)
  const partnerIds = filteredMatches.map(m => m.otherPartnerId)
  const { data: partnerships } = await adminClient
    .from('partnerships')
    .select(
      'id, owner_id, display_name, short_bio, connection_summary, identity, city, age, membership_tier, orientation, structure, latitude, longitude'
    )
    .in('id', partnerIds)

  const partnershipMap = new Map(
    (partnerships || []).map(p => [p.id, p])
  )

  // 3b. Viewer partnership coordinates (for distance)
  const { data: viewerGeo } = await adminClient
    .from('partnerships')
    .select('latitude, longitude')
    .eq('id', currentPartnershipId)
    .maybeSingle()

  const viewerLat =
    typeof viewerGeo?.latitude === 'number' ? viewerGeo.latitude : null
  const viewerLon =
    typeof viewerGeo?.longitude === 'number' ? viewerGeo.longitude : null

  // 3c. Owner survey answers (gender, relationship styles, DOB fallback)
  const ownerIds = [
    ...new Set(
      (partnerships || [])
        .map((p: { owner_id?: string }) => p.owner_id)
        .filter((id): id is string => !!id)
    ),
  ]

  const surveyByUserId = new Map<
    string,
    { answers_json: Record<string, unknown>; completion_pct: number }
  >()

  if (ownerIds.length > 0) {
    const { data: surveys } = await adminClient
      .from('user_survey_responses')
      .select('user_id, answers_json, completion_pct')
      .in('user_id', ownerIds)

    for (const row of surveys || []) {
      if (!row.user_id || !row.answers_json) continue
      const prev = surveyByUserId.get(row.user_id)
      const pct = typeof row.completion_pct === 'number' ? row.completion_pct : 0
      if (!prev || pct > prev.completion_pct) {
        surveyByUserId.set(row.user_id, {
          answers_json: row.answers_json as Record<string, unknown>,
          completion_pct: pct,
        })
      }
    }
  }

  // 4. Fetch photo URLs in one query
  const supabase = await createClient()
  const { data: photos } = await adminClient
    .from('partnership_photos')
    .select('partnership_id, storage_path')
    .in('partnership_id', partnerIds)
    .eq('is_primary', true)
    .eq('photo_type', 'public')

  const photoMap = new Map<string, string>()
  if (photos) {
    for (const photo of photos) {
      if (photo.storage_path) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('partnership-photos')
          .getPublicUrl(photo.storage_path)
        photoMap.set(photo.partnership_id, publicUrl)
      }
    }
  }

  // 5. Assemble results, sorted by score desc, limited
  const results: ComputedMatchCard[] = []
  for (const match of filteredMatches) {
    const partner = partnershipMap.get(match.otherPartnerId)
    if (!partner) continue // Partner no longer exists or not live

    const tier = partner.membership_tier
    const normalizedTier: 'free' | 'plus' = (tier && tier !== 'free') ? 'plus' : 'free'

    const ownerId = (partner as { owner_id?: string }).owner_id
    const ownerSurvey = ownerId ? surveyByUserId.get(ownerId) : undefined
    const answers = ownerSurvey?.answers_json

    const genderRaw = answers?.q2_gender_identity
    const gender =
      typeof genderRaw === 'string' && genderRaw.trim()
        ? genderRaw.trim()
        : null

    let sexuality = parseOrientationValue((partner as { orientation?: unknown }).orientation)
    if (!sexuality && answers?.q3_sexual_orientation) {
      const q3 = answers.q3_sexual_orientation
      sexuality =
        typeof q3 === 'string'
          ? q3.trim()
          : Array.isArray(q3)
            ? q3.filter((x): x is string => typeof x === 'string').join(', ')
            : null
    }

    let relationship_structure = relationshipStylesFromSurveyAnswers(answers)
    if (!relationship_structure) {
      const st = (partner as { structure?: { type?: string; open_to?: string[] } | null })
        .structure
      if (st?.open_to?.length) {
        relationship_structure = st.open_to.slice(0, 2).join(', ')
      }
    }

    let resolvedAge =
      typeof partner.age === 'number' && partner.age > 0 ? partner.age : 0
    if (!resolvedAge && answers) {
      const fromDob = computeAgeFromBirthRaw(answers.q1_age)
      if (fromDob) resolvedAge = fromDob
    }

    const plat = partner as { latitude?: unknown; longitude?: unknown }
    const pLat = typeof plat.latitude === 'number' ? plat.latitude : null
    const pLon = typeof plat.longitude === 'number' ? plat.longitude : null
    let distance_miles: number | undefined
    if (
      viewerLat != null &&
      viewerLon != null &&
      pLat != null &&
      pLon != null
    ) {
      distance_miles = haversineMiles(viewerLat, viewerLon, pLat, pLon)
    }

    const first_name = firstNameFromDisplayName(partner.display_name)

    results.push({
      partnership: {
        id: partner.id,
        display_name: partner.display_name,
        short_bio: partner.short_bio,
        connection_summary: (partner as any).connection_summary || null,
        identity: partner.identity || 'Unknown',
        city: partner.city || 'Unknown',
        age: resolvedAge,
        photo_url: photoMap.get(partner.id),
        membership_tier: normalizedTier,
        first_name,
        gender,
        sexuality,
        relationship_structure,
        distance_miles,
      },
      score: match.score,
      tier: match.tier as 'Platinum' | 'Gold' | 'Silver' | 'Bronze',
      breakdown: parseBreakdown(match.breakdown),
      saved: match.saved,
      readyToMeet: 'none',
      connection: connectionMap.get(match.otherPartnerId) || {
        status: 'none',
        handshakeId: null,
      },
    })
  }

  // Already sorted by score from DB, but ensure after dedup
  results.sort((a, b) => b.score - a.score)

  const sliced = results.slice(0, limit)

  // Ready-to-meet batch (table may not exist until migration 039 is applied)
  try {
    const otherIds = sliced.map((r) => r.partnership.id)
    if (otherIds.length === 0) return sliced

    const pairKeys = new Map<string, { p1: string; p2: string }>()
    for (const oid of otherIds) {
      const { partnership_smaller: p1, partnership_larger: p2 } =
        canonicalPartnershipPair(currentPartnershipId, oid)
      pairKeys.set(`${p1}:${p2}`, { p1, p2 })
    }
    const pairs = [...pairKeys.values()]
    const orFilter = pairs
      .map(
        ({ p1, p2 }) =>
          `and(partnership_smaller.eq.${p1},partnership_larger.eq.${p2})`
      )
      .join(',')

    const { data: sigRows, error: sigErr } = await adminClient
      .from('ready_to_meet_signals')
      .select('partnership_smaller, partnership_larger, signaller_partnership_id')
      .or(orFilter)

    if (!sigErr && sigRows && sigRows.length > 0) {
      const byPair = new Map<string, Set<string>>()
      for (const row of sigRows as {
        partnership_smaller: string
        partnership_larger: string
        signaller_partnership_id: string
      }[]) {
        const k = `${row.partnership_smaller}:${row.partnership_larger}`
        if (!byPair.has(k)) byPair.set(k, new Set())
        byPair.get(k)!.add(row.signaller_partnership_id)
      }
      for (const row of sliced) {
        const oid = row.partnership.id
        const { partnership_smaller: p1, partnership_larger: p2 } =
          canonicalPartnershipPair(currentPartnershipId, oid)
        const set = byPair.get(`${p1}:${p2}`) ?? new Set()
        const v = set.has(currentPartnershipId)
        const o = set.has(oid)
        if (v && o) row.readyToMeet = 'mutual'
        else if (v) row.readyToMeet = 'viewer_ready'
        else row.readyToMeet = 'none'
      }
    }
  } catch (e) {
    console.warn('[getComputedMatchCards] ready_to_meet batch skipped:', e)
  }

  return sliced
}
