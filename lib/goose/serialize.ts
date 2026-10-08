/**
 * The Goose result serializer: the ONLY way a pair leaves HAEVN.
 *
 * Allowlist, not denylist. The output object is built fresh from eight named
 * fields, so nothing on the input row (names, emails, cities, gate reasons,
 * category scores, raw answers, internal flags) can ride along, whatever the
 * caller passes in. findForbiddenGooseKeys is the runtime guard the API layer
 * runs on every payload before it ships; the tests pin the exact key set.
 *
 * Contract v1.0, endpoint 5: {member_id_a, member_id_b, compatibility_pct,
 * classification, headline, considerations, photo_url_a, photo_url_b}.
 */

import { gooseBandFor, toCompatibilityPct } from './gooseBandCopy'

export interface GoosePairResult {
  member_id_a: string
  member_id_b: string
  compatibility_pct: number
  classification: string
  headline: string
  considerations: string
  photo_url_a: string | null
  photo_url_b: string | null
}

/** The exact contract field set, in contract order. */
export const GOOSE_RESULT_KEYS = [
  'member_id_a',
  'member_id_b',
  'compatibility_pct',
  'classification',
  'headline',
  'considerations',
  'photo_url_a',
  'photo_url_b',
] as const

/** The only fields the serializer reads from a stored row. */
export interface SerializableRow {
  member_a: string
  member_b: string
  score: number
}

/** member_id → public primary photo URL (absent / null = no photo). */
export type PhotoLookup = ReadonlyMap<string, string | null>

function safePhotoUrl(url: string | null | undefined): string | null {
  return typeof url === 'string' && /^https:\/\//.test(url) ? url : null
}

export function serializeGoosePair(row: SerializableRow, photos: PhotoLookup = new Map()): GoosePairResult {
  const pct = toCompatibilityPct(row.score)
  const copy = gooseBandFor(pct)
  return {
    member_id_a: String(row.member_a),
    member_id_b: String(row.member_b),
    compatibility_pct: pct,
    classification: copy.classification,
    headline: copy.headline,
    considerations: copy.considerations,
    photo_url_a: safePhotoUrl(photos.get(row.member_a)),
    photo_url_b: safePhotoUrl(photos.get(row.member_b)),
  }
}

const RESULT_KEY_SET = new Set<string>(GOOSE_RESULT_KEYS)
const PAYLOAD_KEY_SET = new Set<string>(['status', 'pairs'])

/**
 * Every key in a results payload that is not on the allowlist, as a path.
 * Accepts a whole payload ({status, pairs}) or a bare pair. [] = safe to ship.
 */
export function findForbiddenGooseKeys(payload: unknown): string[] {
  const bad: string[] = []
  const obj = (payload ?? {}) as Record<string, unknown>
  const isPayload = 'pairs' in obj
  const pairs: unknown[] = isPayload ? (Array.isArray(obj.pairs) ? obj.pairs : []) : [obj]
  if (isPayload) for (const k of Object.keys(obj)) if (!PAYLOAD_KEY_SET.has(k)) bad.push(`payload.${k}`)
  pairs.forEach((p, i) => {
    const rec = (p ?? {}) as Record<string, unknown>
    for (const k of Object.keys(rec)) if (!RESULT_KEY_SET.has(k)) bad.push(`pairs[${i}].${k}`)
    for (const k of GOOSE_RESULT_KEYS) {
      const v = rec[k]
      // Every value is a scalar: an object or array here means something nested leaked in.
      if (v !== null && typeof v === 'object') bad.push(`pairs[${i}].${k}<object>`)
    }
  })
  return bad
}
