/**
 * Seed two QA members (A, B) on PRODUCTION for the account-deletion browser test.
 *
 *   npx tsx scripts/qa/seed-deletion-qa.ts            # seed + print credentials
 *   npx tsx scripts/qa/seed-deletion-qa.ts --verify   # isolation check for existing QA accounts
 *   npx tsx scripts/qa/seed-deletion-qa.ts --links    # mint fresh 15-min handoff links
 *
 * Isolation — nothing here touches another member:
 *   - the matcher is NOT run (it would score A/B against the real pool and write
 *     rows for real members). Only the A–B pair is scored, with the engine's own
 *     calculateCompatibilityFromRaw, and only its two rows are inserted.
 *   - no email/SMS: .invalid addresses (undeliverable by RFC 2606), phone NULL,
 *     and both channels marked notify_*_invalid_at (migration 058 skip flags).
 *   - accounts are tagged user_metadata.qa_test = 'account-deletion' and carry
 *     the TEST- surname, so they are trivially findable.
 * NO deletion happens here — B deletes itself through the UI; A is removed later
 * through the same pipeline.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { calculateCompatibilityFromRaw } from '@/lib/matching/calculateCompatibility'
import { MATCH_MIN_SCORE } from '@/lib/matching/scoreBands'
import { newHandoffToken, hashHandoffToken, hashEmail } from '@/lib/auth/handoff'
import { getMatchInterpretation } from '@/lib/matches/getMatchInterpretation'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const QA_TAG = 'account-deletion'
const ENGINE_VERSION = '5cat-v6' // lib/services/computeMatches.ts
const LINK_TTL_MS = 15 * 60 * 1000
const COMPLETED_SECTIONS = [
  'basic_demographics', 'relationship_preferences', 'communication_attachment', 'lifestyle_values',
  'privacy_community', 'intimacy_sexuality', 'personal_expression', 'personality_insights',
]

/** scripts/seed-synthetic-users.ts baseAnswers(): passes every gate, scores high.
 *  Includes free-text answers on purpose — the anonymizer must drop them. */
function answers(i: number): Record<string, unknown> {
  return {
    q1_age: '1990-05-15', q2_gender_identity: 'Non-binary', q2a_pronouns: 'they/them',
    q3_sexual_orientation: ['Bisexual', 'Pansexual'], q3a_fidelity: 'open_communication', q3b_kinsey_scale: '3',
    q3c_partner_kinsey_preference: ['No preference'], q4_relationship_status: 'partnered',
    q6_relationship_styles: ['ENM', 'Polyamorous'], q6a_connection_type: ['As an individual'],
    q6b_who_to_meet: ['Individuals', 'Couples'], q6c_couple_connection: 'Mix together + solo',
    q6d_couple_permissions: 'equal_autonomy', q7_emotional_exclusivity: 'flexible', q8_sexual_exclusivity: 'open',
    q9_intentions: ['Long-term partnership', 'Community', 'Friendship'], q9a_sex_or_more: 'both_equally',
    q9b_dating_readiness: 'ready', q10_attachment_style: 'secure', q10a_emotional_availability: 'very_available',
    q11_love_languages: ['Quality time', 'Physical touch', 'Words of affirmation'],
    q12_conflict_resolution: 'collaborative', q12a_messaging_pace: 'moderate', q13_lifestyle_alignment: 'important',
    q13a_languages: 'English', q14a_cultural_alignment: 7,
    q14b_cultural_identity: `QA free text ${i === 0 ? 'A' : 'B'}: TEST-DELQA should never be retained`,
    q15_time_availability: 'weekly', q16_typical_availability: ['Weekday evenings', 'Weekends'],
    q16a_first_meet_preference: 'Walk or coffee', Q17: 'no_children', Q17a: ['omnivore'], Q17b: 'has_pets',
    q18_substances: 'social_drinker', q19a_max_distance: 'within_30_miles', q19b_distance_priority: 'moderate',
    q19c_mobility: 'often', q20_discretion: 'moderate', q20a_photo_sharing: 'After chatting', q20b_how_out: 'selective',
    q21_platform_use: ['Dating', 'Community', 'Exploration'], q22_spirituality_sexuality: 'Somewhat connected',
    q23_erotic_styles: ['Sensual', 'Playful', 'Romantic'], q24_experiences: ['Private encounters', 'Workshops'],
    q25_chemistry_vs_emotion: 'both_equally', q25a_frequency: 'few_times_week', q26_roles: ['Verse/Switch'],
    q27_body_type_self: 'Athletic / fit', q27_body_type_preferences: ['Athletic / fit', 'Average build', 'Curvy / soft'],
    q28_hard_boundaries: ['Degradation'], q29_maybe_boundaries: ['Exhibitionism'],
    q30_safer_sex: ['Regular testing', 'Discussion before intimacy'], q30a_fluid_bonding: 'open_to_it',
    q31_health_testing: 'quarterly',
    q32_looking_for: `QA free text ${i === 0 ? 'A' : 'B'}: reach TEST-DELQA at test-delqa@qa.haevn.invalid`,
    q33_kinks: ['Sensory play', 'Role play', 'Bondage'], q33a_experience_level: 'experienced',
    q34_exploration: 7, q34a_variety: 7, q35_agreements: 7, q35a_structure: 5, q36_social_energy: 'ambivert',
    q36a_outgoing: 'ambivert', q37_empathy: 'very_high', q37a_harmony: 'high', q38_jealousy: 'very_low',
    q38a_emotional_reactive: 'low', q_emotional_pace: 3, q_emotional_engagement: 3, q_independence_balance: 3,
    q_age_min: 21, q_age_max: 55, q_race_identity: ['any'], q_race_preference: ['any'],
  }
}

const LOC = [
  { lat: 30.2672, lng: -97.7431 },
  { lat: 30.2673, lng: -97.7432 },
]

// 1x1 teal PNG — a real storage object for the deletion to remove.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgaGD4DwAChAGAj5EOSQAAAABJRU5ErkJggg==',
  'base64'
)

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

async function qaUsers() {
  const users: { id: string; email: string; label: string }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      if (u.user_metadata?.qa_test === QA_TAG) users.push({ id: u.id, email: u.email!, label: u.user_metadata.qa_label })
    }
    if (data.users.length < 1000) break
  }
  return users.sort((a, b) => a.label.localeCompare(b.label))
}

async function mintLink(userId: string, email: string) {
  const token = newHandoffToken()
  const expires = new Date(Date.now() + LINK_TTL_MS).toISOString()
  must(
    await admin.from('login_links').insert({
      token_hash: hashHandoffToken(token), email_hash: hashEmail(email), user_id: userId, sent: false, expires_at: expires,
    }),
    'login_links insert'
  )
  return { token, expires }
}

async function seedMember(label: 'A' | 'B', i: number, runTag: string) {
  const email = `test-delqa-${label.toLowerCase()}-${runTag}@qa.haevn.invalid`
  const password = `Qa-${randomBytes(9).toString('base64url')}`
  const fullName = `Quinn TEST-${label}`
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, qa_test: QA_TAG, qa_label: label },
  })
  if (created.error) throw new Error(`createUser ${label}: ${created.error.message}`)
  const userId = created.data.user.id
  const now = new Date().toISOString()

  must(await admin.from('profiles').upsert({
    user_id: userId, email, full_name: fullName, city: 'Austin', survey_complete: true, msa_status: 'live',
  }, { onConflict: 'user_id' }), 'profiles')

  const partnership = must(await admin.from('partnerships').insert({
    owner_id: userId, profile_type: 'solo', profile_state: 'live', membership_tier: 'free',
    city: 'Austin', msa: 'Austin-Round Rock-Georgetown, TX', display_name: `Quinn TEST-${label}`,
    latitude: LOC[i].lat, longitude: LOC[i].lng, phone: null,
    // Notification suppression (migration 058): both channels skipped.
    notify_phone_invalid_at: now, notify_email_invalid_at: now,
    onboarding_completed_at: now,
  }).select('id').single(), 'partnerships') as { id: string }
  const pid = partnership.id

  must(await admin.from('partnership_members').insert({
    partnership_id: pid, user_id: userId, role: 'owner', survey_reviewed: true, survey_reviewed_at: now,
  }), 'partnership_members')

  must(await admin.from('user_survey_responses').upsert({
    user_id: userId, partnership_id: pid, answers_json: answers(i), completion_pct: 100, current_step: 0,
    completed_sections: COMPLETED_SECTIONS,
  }, { onConflict: 'user_id' }), 'user_survey_responses')

  const path = `${pid}/qa-${label.toLowerCase()}.png`
  const up = await admin.storage.from('public-photos').upload(path, PNG, { contentType: 'image/png', upsert: true })
  if (up.error) throw new Error(`photo upload: ${up.error.message}`)
  const url = admin.storage.from('public-photos').getPublicUrl(path).data.publicUrl
  must(await admin.from('partnership_photos').insert({
    partnership_id: pid, photo_url: url, photo_type: 'public', order_index: 0, is_primary: true,
  }), 'partnership_photos')

  return { label, userId, email, password, pid }
}

async function verify() {
  const users = await qaUsers()
  const pids: Record<string, string> = {}
  for (const u of users) {
    const { data } = await admin.from('partnership_members').select('partnership_id').eq('user_id', u.id)
    pids[u.label] = data?.[0]?.partnership_id
  }
  const ids = Object.values(pids).filter(Boolean)
  const list = ids.join(',')
  const cm = must(await admin.from('computed_matches').select('partnership_a, partnership_b, score, release_at')
    .or(`partnership_a.in.(${list}),partnership_b.in.(${list})`), 'computed_matches') as Array<Record<string, string>>
  const hs = must(await admin.from('handshakes').select('a_partnership, b_partnership, state')
    .or(`a_partnership.in.(${list}),b_partnership.in.(${list})`), 'handshakes') as Array<Record<string, string>>
  const outside = [...cm.map((r) => [r.partnership_a, r.partnership_b]), ...hs.map((r) => [r.a_partnership, r.b_partnership])]
    .filter(([x, y]) => !ids.includes(x) || !ids.includes(y))
  console.log(JSON.stringify({ users: users.map((u) => u.label), pids, computedRows: cm.length, handshakes: hs.length, rowsWithAnyoneElse: outside.length }, null, 2))
  return outside.length
}

async function main() {
  const arg = process.argv[2]
  if (arg === '--verify') process.exit((await verify()) === 0 ? 0 : 1)
  if (arg === '--links') {
    for (const u of await qaUsers()) {
      const l = await mintLink(u.id, u.email)
      console.log(`${u.label}  ${u.email}\n   /login-link/${l.token}   (expires ${l.expires})`)
    }
    return
  }

  const existing = await qaUsers()
  if (existing.length > 0) throw new Error(`QA accounts already exist (${existing.map((u) => u.email).join(', ')}); refusing to seed twice`)

  // Score ONLY this pair, exactly as computeMatches does — BEFORE any write, so
  // a below-threshold pair aborts with nothing seeded.
  const withLoc = (i: number) => ({ ...answers(i), _latitude: LOC[i].lat, _longitude: LOC[i].lng })
  const result = calculateCompatibilityFromRaw(withLoc(0) as never, withLoc(1) as never, false, false)
  if (!result.constraints.passed) throw new Error(`pair failed constraints: ${result.constraints.reason}`)
  if (result.overallScore < MATCH_MIN_SCORE) throw new Error(`pair scored ${result.overallScore} < ${MATCH_MIN_SCORE}`)
  if (!['Platinum', 'Gold', 'Silver', 'Bronze'].includes(result.tier)) throw new Error(`unexpected tier ${result.tier}`)
  console.log(`pair score ${result.overallScore} (${result.tier}) — seeding`)
  if (arg === '--dry') return

  const runTag = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const A = await seedMember('A', 0, runTag)
  const B = await seedMember('B', 1, runTag)

  const nowIso = new Date().toISOString()
  const released = new Date(Date.now() - 60_000).toISOString()
  const expires = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()
  const row = (a: string, b: string) => ({
    partnership_a: a, partnership_b: b, score: result.overallScore, tier: result.tier, breakdown: result.categories,
    computed_at: nowIso, engine_version: ENGINE_VERSION, release_at: released, expires_at: expires,
  })
  must(await admin.from('computed_matches').insert([row(A.pid, B.pid), row(B.pid, A.pid)]), 'computed_matches')

  const [lo, hi] = A.pid < B.pid ? [A, B] : [B, A]
  const hs = must(await admin.from('handshakes').insert({
    a_partnership: lo.pid, b_partnership: hi.pid, a_consent: true, b_consent: true, state: 'matched',
    match_score: result.overallScore, triggered_at: nowIso, matched_at: nowIso,
  }).select('id').single(), 'handshakes') as { id: string }

  const script: Array<[typeof A, string]> = [
    [A, 'Hi! QA test message 1 from TEST-A.'], [B, 'Hey — QA reply 1 from TEST-B.'],
    [A, 'QA message 2 from TEST-A: coffee this week?'], [B, 'QA reply 2 from TEST-B: sounds good.'],
    [A, 'QA message 3 from TEST-A: Thursday works.'], [B, 'QA reply 3 from TEST-B: Thursday it is.'],
    [A, 'QA message 4 from TEST-A: see you then.'], [B, 'QA reply 4 from TEST-B: 👋'],
  ]
  const t0 = Date.now() - script.length * 60_000
  must(await admin.from('messages').insert(script.map(([who, content], k) => ({
    handshake_id: hs.id, sender_partnership: who.pid, content, created_at: new Date(t0 + k * 60_000).toISOString(),
  }))), 'messages')

  // Match report for both viewers (B is the one the QA agent inspects first).
  for (const [viewer, other] of [[B, A], [A, B]] as const) {
    const r = await getMatchInterpretation(admin as never, viewer.pid, other.pid)
    console.log(`interpretation viewer=TEST-${viewer.label}: source=${r.source} degraded=${r.degraded}`)
  }

  const linkA = await mintLink(A.userId, A.email)
  const linkB = await mintLink(B.userId, B.email)
  console.log(JSON.stringify({
    score: result.overallScore, tier: result.tier, handshakeId: hs.id,
    A: { email: A.email, password: A.password, partnershipId: A.pid, userId: A.userId, loginPath: `/login-link/${linkA.token}`, linkExpires: linkA.expires },
    B: { email: B.email, password: B.password, partnershipId: B.pid, userId: B.userId, loginPath: `/login-link/${linkB.token}`, linkExpires: linkB.expires },
  }, null, 2))
  await verify()
}

main().catch((e) => { console.error(e); process.exit(1) })
