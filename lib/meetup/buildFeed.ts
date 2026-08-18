/**
 * Meetup feed builder + outbound push (server-only).
 *
 * buildMeetupFeed: read the current RELEASED pair set, canonicalize + dedupe,
 * join per-member coarse geo (city→centroid) and normalized survey signals,
 * compute the salted pair id + rubric categories, and assemble the anonymized
 * payload. Nothing identifying is read into the record (see assemble.ts).
 *
 * pushMeetupFeed: HMAC-signed POST mirroring the inbound /api/ingest/survey
 * verification in reverse. Fail-safe: if the feature flag or endpoint/secret are
 * unset it SKIPS (never errors) so the cron can ship dark and turn on the day
 * the client hands over the URL.
 */

import { createHmac } from 'crypto'
import type { createAdminClient } from '@/lib/supabase/admin'
import { canonicalPartnershipPair } from '@/lib/utils/partnershipPair'
import { resolveCity } from './cityCentroids'
import {
  normalizeMaxDistanceMiles,
  normalizeMobility,
  normalizeAlcohol,
  normalizeSocialEnergy,
  type UnknownSink,
} from './normalize'
import { computePairId } from './pairId'
import { assembleMeetupRecord, type AssembledMemberInput } from './assemble'
import type { MeetupFeedPayload } from './types'

type Admin = ReturnType<typeof createAdminClient>
const REC_MIN = 77 // matches lib/matching/scoreBands (rec band 77–79; >=80 = match)

export interface BuildResult {
  payload: MeetupFeedPayload
  stats: {
    releasedRows: number
    uniquePairs: number
    unresolvedCityMembers: number
    unresolvedCities: string[]
    unknownTokens: string[]
  }
}

async function fetchAll(admin: Admin, table: string, cols: string, apply?: (q: any) => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    let q = admin.from(table).select(cols).range(from, from + 999)
    if (apply) q = apply(q)
    const { data, error } = await q
    if (error) {
      console.warn(`[meetup-feed] ${table} read: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function buildMeetupFeed(admin: Admin, nowIso?: string): Promise<BuildResult> {
  const now = nowIso ?? new Date().toISOString()

  // 1. Current released pair set (matches >=80 AND rec band 77–79).
  const rows = await fetchAll(
    admin,
    'computed_matches',
    'partnership_a, partnership_b, score, release_at, expires_at, saved',
    (q) => q.lte('release_at', now)
  )

  // 2. Canonicalize + dedupe. Active = released and not expired (saved bypasses expiry).
  const pairByKey = new Map<string, { a: string; b: string; score: number }>()
  for (const r of rows) {
    if (!r.saved && r.expires_at && r.expires_at <= now) continue
    const { partnership_smaller, partnership_larger } = canonicalPartnershipPair(r.partnership_a, r.partnership_b)
    const key = `${partnership_smaller}:${partnership_larger}`
    if (!pairByKey.has(key)) {
      pairByKey.set(key, { a: partnership_smaller, b: partnership_larger, score: r.score })
    }
  }

  // 3. Fetch partner geo + owner survey signals for every partnership in a pair.
  const ids = [...new Set([...pairByKey.values()].flatMap((p) => [p.a, p.b]))]
  const parts = ids.length ? await fetchAll(admin, 'partnerships', 'id, owner_id, city', (q) => q.in('id', ids)) : []
  const partById = new Map<string, { id: string; owner_id: string | null; city: string | null }>()
  for (const p of parts) partById.set(p.id, p)

  const ownerIds = [...new Set(parts.map((p: any) => p.owner_id).filter(Boolean))] as string[]
  const surveyByOwner = new Map<string, { answers: Record<string, unknown>; pct: number }>()
  if (ownerIds.length) {
    const surveys = await fetchAll(
      admin,
      'user_survey_responses',
      'user_id, answers_json, completion_pct',
      (q) => q.in('user_id', ownerIds)
    )
    for (const s of surveys) {
      if (!s.user_id || !s.answers_json) continue
      const pct = typeof s.completion_pct === 'number' ? s.completion_pct : 0
      const prev = surveyByOwner.get(s.user_id)
      if (!prev || pct > prev.pct) surveyByOwner.set(s.user_id, { answers: s.answers_json, pct })
    }
  }

  // 4. Assemble records.
  const salt = process.env.MEETUP_PAIR_SALT || ''
  const unresolvedCities = new Set<string>()
  let unresolvedCityMembers = 0
  const unknownTokens = new Set<string>()
  const sink: UnknownSink = { push: (field, value) => unknownTokens.add(`${field}=${value}`) }

  const buildMember = (partnershipId: string, role: 'a' | 'b'): AssembledMemberInput => {
    const part = partById.get(partnershipId)
    const city = resolveCity(part?.city)
    if (!city && part?.city) unresolvedCities.add(String(part.city))
    if (!city) unresolvedCityMembers++
    const answers = (part?.owner_id ? surveyByOwner.get(part.owner_id)?.answers : undefined) ?? {}
    return {
      role,
      city_id: city?.city_id ?? null,
      city_label: city?.city_label ?? null,
      centroid: city?.centroid ?? null,
      max_distance_miles: normalizeMaxDistanceMiles(answers['q19a_max_distance'], sink),
      mobility: normalizeMobility(answers['q19c_mobility'], sink),
      geo_unresolved: city === null,
      rubric: {
        alcohol: normalizeAlcohol(answers['q18_substances'], sink),
        socialEnergy: normalizeSocialEnergy(answers['q36_social_energy']),
      },
    }
  }

  const pairs = [...pairByKey.values()]
    .filter((p) => partById.has(p.a) && partById.has(p.b)) // both partnerships still exist
    .map((p) =>
      assembleMeetupRecord({
        pair_id: computePairId(p.a, p.b, salt),
        type: p.score >= 80 ? 'match' : 'recommendation',
        memberA: buildMember(p.a, 'a'),
        memberB: buildMember(p.b, 'b'),
      })
    )

  const payload: MeetupFeedPayload = {
    snapshot_date: now.slice(0, 10),
    generated_at: now,
    pair_count: pairs.length,
    pairs,
  }

  return {
    payload,
    stats: {
      releasedRows: rows.length,
      uniquePairs: pairByKey.size,
      unresolvedCityMembers,
      unresolvedCities: [...unresolvedCities],
      unknownTokens: [...unknownTokens],
    },
  }
}

export type PushResult =
  | { pushed: false; skipped: true; reason: string }
  | { pushed: true; status: number; ok: boolean }
  | { pushed: false; skipped: false; error: string }

/**
 * Push the payload to the Emergent endpoint with an HMAC signature mirroring
 * /api/ingest/survey (sign `${timestamp}.${rawBody}`; header X-HAEVN-Signature:
 * sha256=<hex> + X-HAEVN-Timestamp). Fail-safe: unconfigured → skip, never throw.
 */
export async function pushMeetupFeed(payload: MeetupFeedPayload): Promise<PushResult> {
  const enabled = process.env.MEETUP_FEED_ENABLED === 'true'
  const endpoint = process.env.EMERGENT_MEETUP_ENDPOINT || ''
  const secret = process.env.MEETUP_FEED_PUSH_SECRET || ''
  if (!enabled || !endpoint || !secret) {
    return {
      pushed: false,
      skipped: true,
      reason: `unconfigured (enabled=${enabled} endpoint=${!!endpoint} secret=${!!secret})`,
    }
  }

  const rawBody = JSON.stringify(payload)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HAEVN-Signature': `sha256=${signature}`,
        'X-HAEVN-Timestamp': timestamp,
      },
      body: rawBody,
    })
    return { pushed: true, status: res.status, ok: res.ok }
  } catch (e: any) {
    return { pushed: false, skipped: false, error: e?.message || 'push failed' }
  }
}
