/**
 * completion_v1 (survey.completed webhook) -> HAEVN import shape.
 *
 * Pure + unit-testable: no DB, no I/O. Deliberately thin — it adapts the wire
 * contract onto the EXISTING importer mapping (lib/import/emergentImport.ts),
 * which already owns the hard part: the Q-ID -> answers_json reconciliation
 * (SIMPLE_KEY_MAP), {selected,other_text} unwrapping, numeric coercion, the
 * Q1 birthdate build, and — critically — tolerance of legitimately-missing keys
 * from conditional survey logic. We do NOT reinvent that.
 *
 * Two deliberate DEVIATIONS from mapEmergentSubmission, both safety-critical:
 *
 *   1. CITY. The mapper defaults `city: market || 'Austin'`. With city-based
 *      release gating live, that default is a landmine: an unresolvable location
 *      would become "Austin" -> resolve to the LIVE Austin market -> the member
 *      gets released and notified even though we don't know where they are.
 *      Here, unknown location => UNKNOWN_CITY sentinel, which resolves to NO
 *      market => withheld (fail closed). We withhold, we never reject.
 *
 *   2. Q0_JOIN. The mapper silently defaults profile_type to 'solo' when
 *      Q0_JOIN is absent. Silently mis-typing every couple/pod as solo corrupts
 *      matching. Here, absence is surfaced (needsReview) rather than guessed.
 */

import { mapEmergentSubmission, type EmergentSubmission, type MappedImport } from '@/lib/import/emergentImport'

/**
 * City value used when the payload carries no usable city. Chosen to resolve to
 * NO market so the release gate withholds the member (fail closed) until their
 * real location/market is known. Must never match an msa_allowed_zips.city.
 */
export const UNKNOWN_CITY = 'Unknown'

/**
 * partnerships.identity is a STRUCTURE field constrained to
 * ('single','couple','throuple') by partnerships_identity_check — it is NOT
 * gender.
 *
 * The shared mapper sets identity from q2_gender_identity ('man'/'woman'), which
 * the constraint REJECTS. Because the importer applies these columns in one
 * UPDATE, that single invalid value makes the whole statement fail — silently
 * dropping display_name, phone AND profile_type with it (the failure is only
 * console.warn'd). Measured on live data: 498/511 partnerships have a NULL
 * display_name, 501/511 a NULL phone, and 508/511 sit at the DB's default
 * profile_type='solo' — i.e. the enrich has been failing for essentially the
 * entire imported cohort, which is why that cohort has no phone numbers.
 *
 * So we derive identity from the join type, exactly as scripts/seed-admin-users
 * already does.
 */
function identityForType(t: 'solo' | 'couple' | 'pod'): 'single' | 'couple' | 'throuple' {
  return t === 'couple' ? 'couple' : t === 'pod' ? 'throuple' : 'single'
}

/**
 * Q0_JOIN -> profile_type. Returns null when absent OR unrecognized, so the
 * caller can flag for review instead of silently mis-typing a couple as solo.
 * (The shared mapper only understands 'couple'/'group' and silently defaults
 * everything else to 'solo' — including a literal 'pod'.)
 */
export function profileTypeFromJoin(join: unknown): 'solo' | 'couple' | 'pod' | null {
  const j = String(join ?? '').trim().toLowerCase()
  if (!j) return null
  if (j === 'couple' || j === 'duo') return 'couple'
  if (j === 'group' || j === 'pod' || j === 'throuple' || j === 'triad') return 'pod'
  if (j === 'solo' || j === 'single' || j === 'individual') return 'solo'
  return null // unknown value -> review, never a guess
}

export interface CompletionV1 {
  event?: string
  event_id?: string
  occurred_at?: string
  survey_version?: string
  submission_id?: string
  identity?: { email?: string | null; mobile?: string | null; first_name?: string | null; last_name?: string | null }
  location?: {
    zip?: string | null; city?: string | null; state?: string | null; county?: string | null
    lat?: number | null; lng?: number | null; market?: string | null
    is_early_signup?: boolean | null; location_quality?: string | null
  }
  attribution?: Record<string, any>
  quality?: { score?: number | null; flags?: string[] | null; time_spent_seconds?: number | null; honeypot_triggered?: boolean | null }
  photos?: Array<{ photo_id?: string; is_primary?: boolean; url?: string; thumb_url?: string }>
  answers?: Record<string, any> | null
  timestamps?: { started_at?: string; submitted_at?: string }
  [k: string]: any
}

export interface AdaptResult {
  ok: boolean
  /** 400-able reason when !ok. */
  error?: string
  mapped?: MappedImport
  /** The city actually written to partnerships (post-override). */
  resolvedCity?: string
  /** Payload's market label — traceability only, NEVER used for gating. */
  sourceMarket?: string | null
  needsReview?: boolean
  reviewReason?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validate the envelope. Malformed => 400 (never a silent 200). */
export function validateCompletionV1(p: CompletionV1 | null | undefined): string | null {
  if (!p || typeof p !== 'object') return 'body is not a JSON object'
  if (p.event !== 'survey.completed') return `unsupported event: ${String(p.event)}`
  if (!p.submission_id || typeof p.submission_id !== 'string') return 'missing submission_id'
  const email = p.identity?.email
  if (!email || !EMAIL_RE.test(String(email).trim())) return 'missing or invalid identity.email'
  if (!p.answers || typeof p.answers !== 'object' || Array.isArray(p.answers)) return 'missing answers object'
  return null
}

/**
 * Adapt completion_v1 -> MappedImport via the existing importer mapping.
 *
 * The contract ships `answers` as raw_answers verbatim (Q-ID keyed), which is
 * exactly what mapEmergentSubmission expects — so the reconciliation is reuse,
 * not reimplementation.
 */
export function adaptCompletionV1(p: CompletionV1): AdaptResult {
  const invalid = validateCompletionV1(p)
  if (invalid) return { ok: false, error: invalid }

  const raw = p.answers as Record<string, any>
  const loc = p.location ?? {}

  // The event IS survey.completed => submitted, 100%. (Approved: the contract
  // carries no percent_complete/completion_status.)
  const sub: EmergentSubmission = {
    submission_id: p.submission_id,
    email: p.identity?.email ?? null,
    mobile: p.identity?.mobile ?? null,
    first_name: p.identity?.first_name ?? null,
    last_name: p.identity?.last_name ?? null,
    city_or_zip: loc.zip ?? null,
    zip_city: loc.city ?? null,
    zip_state: loc.state ?? null,
    market: loc.market ?? null,
    completion_status: 'submitted',
    percent_complete: 100,
    raw_answers: raw,
    quality_flags: p.quality?.flags ?? [],
    survey_mode: raw?.survey_mode,
  }

  const mapped = mapEmergentSubmission(sub)
  if (!mapped.eligible) return { ok: false, error: mapped.skipReason || 'ineligible submission' }

  // ── DEVIATION 1: city. Never inherit the mapper's 'Austin' default. ────────
  // Gating resolves partnerships.city against msa_allowed_zips.city, so we want
  // the real CITY name (e.g. "Round Rock"), not the market label (e.g.
  // "Tampa/St. Pete", which resolves to nothing anyway). market is traceability
  // only. No city => sentinel => no market => withheld.
  const cityFromPayload = String(loc.city ?? '').trim()
  const resolvedCity = cityFromPayload || UNKNOWN_CITY

  // ── DEVIATION 2: Q0_JOIN -> profile_type. Absence OR an unrecognized value
  //    must not silently mis-type a couple as a single person. ───────────────
  const joinType = profileTypeFromJoin(raw?.Q0_JOIN)
  const needsReview = joinType === null
  const reviewReason = needsReview
    ? `Q0_JOIN ${raw?.Q0_JOIN === undefined ? 'absent' : `unrecognized (${JSON.stringify(raw?.Q0_JOIN)})`} — profile_type fell back to 'solo' and may be wrong (couple/pod mis-typed). Review before this member is matched.`
    : undefined
  const profileType: 'solo' | 'couple' | 'pod' = joinType ?? 'solo'

  return {
    ok: true,
    mapped: {
      ...mapped,
      completionPct: 100,
      partnership: {
        ...mapped.partnership,
        city: resolvedCity,                       // override
        profile_state: 'live',                    // approved: survey.completed
        profile_type: profileType,                // override (robust Q0_JOIN read)
        // ── DEVIATION 3: identity must be the STRUCTURE value, never gender.
        //    Gender here violates partnerships_identity_check and takes the
        //    whole enrich UPDATE down with it (dropping phone + profile_type).
        identity: identityForType(profileType),
        zip_code: loc.zip ? String(loc.zip).trim() : mapped.partnership.zip_code,
        state: loc.state ? String(loc.state).trim() : mapped.partnership.state,
        phone: p.identity?.mobile ?? mapped.partnership.phone,
      },
      profile: {
        ...mapped.profile,
        city: resolvedCity,                       // override (same reason)
        survey_complete: true,
      },
    },
    resolvedCity,
    sourceMarket: loc.market ?? null,
    needsReview,
    reviewReason,
  }
}
