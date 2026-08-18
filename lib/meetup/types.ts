/**
 * Meetup Spots nightly feed — shared types + the PRIVACY CONTRACT.
 *
 * The allowlists below are the enforcement of the privacy boundary (see
 * docs/plans/meetup-spots-feed.md §6): the only keys permitted to cross to the
 * client's Emergent environment. `findForbiddenKeys` walks a serialized payload
 * and returns anything not on the allowlist — the acceptance-critical test uses
 * it so that carelessly adding an identity/PII field to a record FAILS the suite.
 */

/** Extensible category enum. Hotels are intentionally NOT emitted in v1. */
export const MEETUP_CATEGORIES = [
  'coffee',
  'restaurant',
  'activity',
  'cocktail_bar',
  'wine_bar',
  'brewery',
  // 'hotel' — reserved; excluded in v1 pending the client's stage rules.
] as const
export type MeetupCategory = (typeof MEETUP_CATEGORIES)[number]

export type Confidence = 'high' | 'normal' | 'low_confidence'

export interface QualifiedCategory {
  category: MeetupCategory
  confidence: Confidence
}

export interface MeetupMember {
  /** Positional canonical role only ('a' = smaller partnership id). NOT an id. */
  role: 'a' | 'b'
  city_id: string | null
  city_label: string | null
  /** City-level centroid [lat, lon] — public, non-personal. null when unresolved. */
  centroid: [number, number] | null
  /** Coarse travel willingness in miles (from q19a). null when unknown. */
  max_distance_miles: number | null
  /** Coarse mobility bucket (from q19c): local|occasional|frequent|flexible|unknown. */
  mobility: string
  /** True when the member's city is not in the static centroid table. */
  geo_unresolved: boolean
}

export interface MeetupRecord {
  /** Salted HMAC of the canonical pair — stable nightly, unlinkable without salt. */
  pair_id: string
  /** The ONLY pair classifier that crosses. Score/tier never do. */
  type: 'match' | 'recommendation'
  active: true
  members: [MeetupMember, MeetupMember]
  qualified_meetup_categories: QualifiedCategory[]
}

export interface MeetupFeedPayload {
  snapshot_date: string // UTC YYYY-MM-DD
  generated_at: string // ISO
  pair_count: number
  pairs: MeetupRecord[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY CONTRACT — the allowlists. Anything not here must never serialize out.
// ─────────────────────────────────────────────────────────────────────────────

export const ALLOWED_PAYLOAD_KEYS = ['snapshot_date', 'generated_at', 'pair_count', 'pairs'] as const
export const ALLOWED_RECORD_KEYS = ['pair_id', 'type', 'active', 'members', 'qualified_meetup_categories'] as const
export const ALLOWED_MEMBER_KEYS = [
  'role',
  'city_id',
  'city_label',
  'centroid',
  'max_distance_miles',
  'mobility',
  'geo_unresolved',
] as const
export const ALLOWED_CATEGORY_KEYS = ['category', 'confidence'] as const

/**
 * Walk a feed payload and collect every object key that is not on an allowlist.
 * A non-empty result means the privacy boundary has been breached (a field was
 * added without updating the contract) — the test fails on it.
 */
export function findForbiddenKeys(payload: unknown): string[] {
  const bad: string[] = []
  const payloadKeys = new Set<string>(ALLOWED_PAYLOAD_KEYS)
  const recordKeys = new Set<string>(ALLOWED_RECORD_KEYS)
  const memberKeys = new Set<string>(ALLOWED_MEMBER_KEYS)
  const categoryKeys = new Set<string>(ALLOWED_CATEGORY_KEYS)

  const p = payload as MeetupFeedPayload
  for (const k of Object.keys(p ?? {})) if (!payloadKeys.has(k)) bad.push(`payload.${k}`)
  for (const rec of p?.pairs ?? []) {
    for (const k of Object.keys(rec ?? {})) if (!recordKeys.has(k)) bad.push(`record.${k}`)
    for (const m of rec?.members ?? []) {
      for (const k of Object.keys(m ?? {})) if (!memberKeys.has(k)) bad.push(`member.${k}`)
    }
    for (const c of rec?.qualified_meetup_categories ?? []) {
      for (const k of Object.keys(c ?? {})) if (!categoryKeys.has(k)) bad.push(`category.${k}`)
    }
  }
  return bad
}
