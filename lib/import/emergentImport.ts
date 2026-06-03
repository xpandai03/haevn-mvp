/**
 * Emergent survey submission → HAEVN import mapping (pure, no DB).
 *
 * The Emergent demo (demo/survey.haevn.com) stores answers under uppercase
 * question codes (`Q1`, `Q2`, `Q9`, …) inside `raw_answers`. The HAEVN app
 * stores answers under lowercase semantic keys (`q1_age`, `q2_gender_identity`,
 * `q9_intentions`, …) in `user_survey_responses.answers_json`, which is what the
 * matching engine reads. This module converts one Emergent submission into the
 * records the import API needs, and is unit-testable in isolation.
 */

export interface EmergentSubmission {
  submission_id?: string
  email?: string | null
  mobile?: string | null
  first_name?: string | null
  last_name?: string | null
  city_or_zip?: string | null
  market?: string | null
  zip_city?: string | null
  zip_state?: string | null
  completion_status?: string | null
  percent_complete?: number | null
  consent_to_contact?: boolean | null
  raw_answers?: Record<string, any> | null
  [k: string]: any
}

export interface MappedImport {
  eligible: boolean
  /** Reason the record was skipped (when !eligible). */
  skipReason?: string
  email: string
  fullName: string
  firstName: string
  /** answers_json for user_survey_responses (HAEVN keys). */
  answers: Record<string, any>
  completionPct: number
  /** Derived columns to set on the partnerships row. */
  partnership: {
    display_name: string
    city: string
    state: string | null
    zip_code: string | null
    age: number | null
    identity: string | null
    phone: string | null
    profile_type: 'solo' | 'couple' | 'pod'
    profile_state: 'draft' | 'live'
    orientation: Record<string, unknown>
    structure: Record<string, unknown>
    intentions: unknown[]
  }
  /** profiles row fields. */
  profile: {
    full_name: string
    city: string
    msa_status: 'live' | 'waitlist'
    survey_complete: boolean
  }
  flags: {
    honeypot: boolean
    submitted: boolean
    market: string | null
  }
}

/**
 * JSON code → HAEVN answers_json key, for fields that pass through directly
 * (after unwrapping `{selected, other_text}` objects).
 */
const SIMPLE_KEY_MAP: Record<string, string> = {
  Q2: 'q2_gender_identity',
  Q2a: 'q2a_pronouns',
  Q3: 'q3_sexual_orientation',
  Q3a: 'q3a_fidelity',
  Q3b: 'q3b_kinsey_scale',
  Q3c: 'q3c_partner_kinsey_preference',
  Q4: 'q4_relationship_status',
  Q6: 'q6_relationship_styles',
  Q6a: 'q6a_connection_type',
  Q6b: 'q6b_who_to_meet',
  Q6c: 'q6c_couple_connection',
  Q6d: 'q6d_couple_permissions',
  Q7: 'q7_emotional_exclusivity',
  Q8: 'q8_sexual_exclusivity',
  Q9: 'q9_intentions',
  Q9a: 'q9a_sex_or_more',
  Q9b: 'q9b_dating_readiness',
  Q10: 'q10_attachment_style',
  Q10a: 'q10a_emotional_availability',
  Q11: 'q11_love_languages',
  Q12: 'q12_conflict_resolution',
  Q12a: 'q12a_messaging_pace',
  Q13: 'q13_lifestyle_alignment',
  Q13a: 'q13a_languages',
  Q14a: 'q14a_cultural_alignment',
  Q14b: 'q14b_cultural_identity',
  Q15: 'q15_time_availability',
  Q16: 'q16_typical_availability',
  Q16a: 'q16a_first_meet_preference',
  Q17: 'q17_children',
  Q17a: 'q17a_dietary',
  Q17b: 'q17b_pets',
  Q18: 'q18_substances',
  Q19a: 'q19a_max_distance',
  Q19b: 'q19b_distance_priority',
  Q19c: 'q19c_mobility',
  Q20: 'q20_discretion',
  Q20a: 'q20a_photo_sharing',
  Q20b: 'q20b_how_out',
  Q21: 'q21_platform_use',
  Q22: 'q22_spirituality_sexuality',
  Q23: 'q23_erotic_styles',
  Q24: 'q24_experiences',
  Q25: 'q25_chemistry_vs_emotion',
  Q25a: 'q25a_frequency',
  Q26: 'q26_roles',
  // Emergent has a single Q27 (partner preferences). HAEVN splits self vs
  // preferred; map to preferences (values like "younger/mature/none").
  Q27: 'q27_body_type_preferences',
  Q28: 'q28_hard_boundaries',
  Q29: 'q29_maybe_boundaries',
  Q30: 'q30_safer_sex',
  Q30a: 'q30a_fluid_bonding',
  Q31: 'q31_health_testing',
  Q32: 'q32_looking_for',
  Q33: 'q33_kinks',
  Q33a: 'q33a_experience_level',
  Q34: 'q34_exploration',
  Q34a: 'q34a_variety',
  Q35: 'q35_agreements',
  Q35a: 'q35a_structure',
  Q36: 'q36_social_energy',
  Q36a: 'q36a_outgoing',
  Q37: 'q37_empathy',
  Q37a: 'q37a_harmony',
  Q38: 'q38_jealousy',
  Q38a: 'q38a_emotional_reactive',
  // Best-guess mapping: Emergent Q39/Q40/Q41 are the three emotional /
  // independence likert items the matcher knows as these keys.
  Q39: 'Q_EMOTIONAL_PACE',
  Q40: 'Q_EMOTIONAL_ENGAGEMENT',
  Q41: 'Q_INDEPENDENCE_BALANCE',
}

/** Keys whose answers are numeric likert scales (coerce "3" → 3). */
const NUMERIC_KEYS = new Set([
  'q7_emotional_exclusivity',
  'q8_sexual_exclusivity',
  'q12a_messaging_pace',
  'q13_lifestyle_alignment',
  'q20_discretion',
  'q22_spirituality_sexuality',
  'q25_chemistry_vs_emotion',
  'q34_exploration',
  'q34a_variety',
  'q35_agreements',
  'q35a_structure',
  'q36_social_energy',
  'q36a_outgoing',
  'q37_empathy',
  'q37a_harmony',
  'q38_jealousy',
  'q38a_emotional_reactive',
  'Q_EMOTIONAL_PACE',
  'Q_EMOTIONAL_ENGAGEMENT',
  'Q_INDEPENDENCE_BALANCE',
])

/** Unwrap `{ selected, other_text }` → selected; pass everything else through. */
function unwrap(v: any): any {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'selected' in v) {
    return (v as { selected: unknown }).selected
  }
  return v
}

function toNumber(v: any): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v)
  }
  return undefined
}

/** Build an ISO `YYYY-MM-DD` birthdate from Emergent Q1 `{month, day, year}`. */
function birthIso(q1: any): string | undefined {
  if (!q1 || typeof q1 !== 'object') return undefined
  const { year, month, day } = q1 as Record<string, number>
  if (!year || !month || !day) return undefined
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

const AGE_BAND_BOUNDS: Record<string, [number, number]> = {
  '18-24': [18, 24],
  '25-30': [25, 30],
  '31-35': [31, 35],
  '36-40': [36, 40],
  '41-45': [41, 45],
  '46-50': [46, 50],
  '51-55': [51, 55],
  '56-60': [56, 60],
  '61-65': [61, 65],
  '65+': [65, 99],
}

/** Emergent Q42 age bands → q_age_min / q_age_max. */
function ageRange(bands: any): { min?: number; max?: number } {
  if (!Array.isArray(bands)) return {}
  let min = Infinity
  let max = -Infinity
  for (const b of bands) {
    const bounds = AGE_BAND_BOUNDS[b as string]
    if (bounds) {
      min = Math.min(min, bounds[0])
      max = Math.max(max, bounds[1])
    }
  }
  if (min === Infinity) return {}
  return { min, max }
}

function firstNameOf(s: EmergentSubmission): string {
  const f = (s.first_name || '').trim()
  if (f) return f.split(/\s+/)[0]
  const email = (s.email || '').trim()
  return email ? email.split('@')[0] : 'Member'
}

function isZip(v: string | null | undefined): boolean {
  return !!v && /^\d{5}$/.test(v.trim())
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Map one Emergent submission to the records the importer writes. Records
 * without a valid email or with effectively no answers are marked ineligible.
 */
export function mapEmergentSubmission(s: EmergentSubmission): MappedImport {
  const email = (s.email || '').trim().toLowerCase()
  const raw = s.raw_answers || {}
  const answerKeyCount = Object.keys(raw).length

  const firstName = firstNameOf(s)
  const fullName = [s.first_name, s.last_name]
    .map((x) => (x || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim() || firstName

  const submitted = s.completion_status === 'submitted'
  const honeypot =
    Array.isArray(s.quality_flags) &&
    s.quality_flags.includes('honeypot_triggered')
  const market = (s.market || s.zip_city || null) as string | null

  const base: MappedImport = {
    eligible: true,
    email,
    fullName,
    firstName,
    answers: {},
    completionPct: 0,
    partnership: {
      display_name: fullName,
      city: market || 'Austin',
      state: null,
      zip_code: isZip(s.city_or_zip) ? (s.city_or_zip as string) : null,
      age: null,
      identity: null,
      phone: (s.mobile || null) as string | null,
      profile_type: 'solo',
      profile_state: 'draft',
      orientation: {},
      structure: {},
      intentions: [],
    },
    profile: {
      full_name: fullName,
      city: market || 'Austin',
      msa_status: 'live',
      survey_complete: false,
    },
    flags: { honeypot, submitted, market },
  }

  if (!EMAIL_RE.test(email)) {
    return { ...base, eligible: false, skipReason: 'missing or invalid email' }
  }
  if (answerKeyCount < 3) {
    return { ...base, eligible: false, skipReason: 'no survey answers' }
  }

  // --- Map answers ---
  const answers: Record<string, any> = {}
  for (const [code, haevnKey] of Object.entries(SIMPLE_KEY_MAP)) {
    if (!(code in raw)) continue
    let val = unwrap(raw[code])
    if (val === undefined || val === null || val === '') continue
    if (NUMERIC_KEYS.has(haevnKey)) {
      const n = toNumber(val)
      if (n === undefined) continue
      val = n
    }
    answers[haevnKey] = val
  }

  // Q1 → birthdate + age
  const iso = birthIso(raw.Q1)
  if (iso) answers.q1_age = iso
  const age = toNumber(raw.Q1?.age)

  // Q42 → age preference range
  const { min, max } = ageRange(raw.Q42)
  if (min !== undefined) answers.q_age_min = String(min)
  if (max !== undefined) answers.q_age_max = String(max)

  // Q43 self race / Q44 race preference
  if (typeof raw.Q43 === 'string' && !['pns', 'np'].includes(raw.Q43)) {
    answers.q_race_identity = [raw.Q43]
  }
  if (Array.isArray(raw.Q44)) {
    const prefs = raw.Q44.filter((r: string) => r !== 'np')
    if (prefs.length > 0) answers.q_race_preference = prefs
  }

  // Survey-mode passthrough (helps downstream display/segmentation)
  if (s.survey_mode) answers.survey_mode = s.survey_mode

  // --- Derived partnership/profile fields ---
  const gender = answers.q2_gender_identity
  const identity =
    typeof gender === 'string' && gender.trim() ? gender.trim() : null
  const orientationVal = answers.q3_sexual_orientation
  const orientation =
    orientationVal != null ? { value: orientationVal } : {}
  const structure = Array.isArray(answers.q6_relationship_styles)
    ? { open_to: answers.q6_relationship_styles }
    : {}
  const intentions = Array.isArray(answers.q9_intentions)
    ? answers.q9_intentions
    : []

  const join = String(s.raw_answers?.Q0_JOIN || 'solo')
  const profileType: 'solo' | 'couple' | 'pod' =
    join === 'couple' ? 'couple' : join === 'group' ? 'pod' : 'solo'

  const completionPct = Math.max(
    0,
    Math.min(100, Math.round(Number(s.percent_complete) || 0))
  )
  const profileState: 'draft' | 'live' = submitted ? 'live' : 'draft'
  const stateCode =
    typeof s.zip_state === 'string' && /^[A-Z]{2}$/.test(s.zip_state)
      ? s.zip_state
      : null

  return {
    ...base,
    eligible: true,
    answers,
    completionPct,
    partnership: {
      ...base.partnership,
      age: age ?? null,
      identity,
      profile_type: profileType,
      profile_state: profileState,
      state: stateCode,
      orientation,
      structure,
      intentions,
    },
    profile: {
      full_name: fullName,
      city: market || 'Austin',
      msa_status: 'live',
      survey_complete: submitted && completionPct >= 100,
    },
  }
}

/** Normalize an uploaded JSON payload into an array of submissions. */
export function extractSubmissions(data: unknown): EmergentSubmission[] {
  if (Array.isArray(data)) return data as EmergentSubmission[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const k of ['users', 'submissions', 'records', 'data']) {
      if (Array.isArray(obj[k])) return obj[k] as EmergentSubmission[]
    }
    return [data as EmergentSubmission]
  }
  return []
}
