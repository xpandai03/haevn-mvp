/**
 * Goose cohort QA harness — the joint-test tool for the event-partner
 * integration. Drives the real pipeline (lib/goose) against the database in
 * .env.local through the same internal functions the API routes will call.
 *
 *   npx tsx scripts/qa/seed-goose-cohort.ts               # seed 6 + run everything, print report
 *   npx tsx scripts/qa/seed-goose-cohort.ts --n 8         # population size (default 6)
 *   npx tsx scripts/qa/seed-goose-cohort.ts --cleanup     # remove every QA cohort, member, file, event
 *   npx tsx scripts/qa/seed-goose-cohort.ts --parity 200  # READ-ONLY: cohort scorer vs stored weekly scores
 *   npx tsx scripts/qa/seed-goose-cohort.ts --seed-joint [--domain qa.haevn.co]
 *       # 6 singles + 1 couple for the partner's conformance run; NO cohort; prints emails.
 *       # Default domain qa.haevn.invalid. Use a real-TLD domain with NO MX record when
 *       # the partner's validator rejects .invalid (qa.haevn.co: no MX, no A, no wildcard).
 *   npx tsx scripts/qa/seed-goose-cohort.ts --verify-joint   # re-check every seeded email resolves
 *   npx tsx scripts/qa/seed-goose-cohort.ts --drill-drop <member_id>     # joint-test failure drill:
 *   npx tsx scripts/qa/seed-goose-cohort.ts --drill-restore <member_id>  #   survey 100→99→100
 *   npx tsx scripts/qa/seed-goose-cohort.ts --http https://www.haevn.app
 *       # seed 6, drive the full lifecycle over the REAL HTTPS API with
 *       # GOOSE_SHARED_SECRET from .env.local (never printed), plus negative
 *       # proofs; prints a redacted transcript. Follow with --cleanup.
 *
 * Isolation — nothing here touches a real member:
 *   - synthetic members only: TEST- surnames, .invalid emails (undeliverable,
 *     RFC 2606), phone NULL, both notify channels marked invalid (migration
 *     058 skip flags), tagged user_metadata.qa_test = 'goose'.
 *   - partnerships are profile_state 'draft', so the weekly recompute (live
 *     only) never sees them. A cohort ignores the live filter by design, which
 *     this run proves on the real database.
 *   - asserts computed_matches is byte-for-byte untouched (count + newest
 *     computed_at before and after).
 *   - alerts go to a console transport here (no email), so a drill never
 *     pages anyone. --live-alerts uses the real Resend path + GOOSE_ALERT_EMAILS.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { randomBytes, randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { associateMember, createCohort, finalizeCohort, getCohortResults, getCohortStatus } from '@/lib/goose/cohorts'
import { createSupabaseGooseRepo, type GooseRepo } from '@/lib/goose/repo'
import { runGooseCompute } from '@/lib/goose/run'
import { scorePair } from '@/lib/goose/score'
import { findForbiddenGooseKeys, GOOSE_RESULT_KEYS } from '@/lib/goose/serialize'
import type { AlertTransport } from '@/lib/goose/alerts'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const QA_TAG = 'goose'
const EVENT_PREFIX = 'qa-goose-'
const BUCKET = 'public-photos'
const COMPLETED_SECTIONS = [
  'basic_demographics', 'relationship_preferences', 'communication_attachment', 'lifestyle_values',
  'privacy_community', 'intimacy_sexuality', 'personal_expression', 'personality_insights',
]
// 1x1 teal PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgaGD4DwAChAGAj5EOSQAAAABJRU5ErkJggg==', 'base64')

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

/** scripts/seed-synthetic-users.ts baseAnswers(), personality varied per member. */
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
    q12_conflict_resolution: i % 3 === 0 ? 'collaborative' : 'passive', q12a_messaging_pace: 'moderate',
    q13_lifestyle_alignment: 'important', q13a_languages: 'English', q14a_cultural_alignment: 1 + (i % 9),
    q15_time_availability: i % 2 ? 'weekly' : 'monthly', q16_typical_availability: ['Weekday evenings', 'Weekends'],
    q16a_first_meet_preference: 'Walk or coffee', Q17: 'no_children', Q17a: ['omnivore'], Q17b: 'has_pets',
    q18_substances: 'social_drinker', q19a_max_distance: 'within_30_miles', q19b_distance_priority: 'moderate',
    q19c_mobility: 'often', q20_discretion: 'moderate', q20a_photo_sharing: 'After chatting', q20b_how_out: 'selective',
    q21_platform_use: ['Dating', 'Community', 'Exploration'], q22_spirituality_sexuality: 'Somewhat connected',
    q23_erotic_styles: ['Sensual', 'Playful', 'Romantic'], q24_experiences: ['Private encounters', 'Workshops'],
    q25_chemistry_vs_emotion: 'both_equally', q25a_frequency: 'few_times_week', q26_roles: ['Verse/Switch'],
    q27_body_type_self: 'Athletic / fit', q27_body_type_preferences: ['Athletic / fit', 'Average build', 'Curvy / soft'],
    q28_hard_boundaries: ['Degradation'], q29_maybe_boundaries: ['Exhibitionism'],
    q30_safer_sex: ['Regular testing', 'Discussion before intimacy'], q30a_fluid_bonding: 'open_to_it',
    q31_health_testing: 'quarterly', q33_kinks: ['Sensory play', 'Role play', 'Bondage'],
    q33a_experience_level: 'experienced', q34_exploration: 1 + (i % 9), q34a_variety: 1 + ((i * 3) % 9),
    q35_agreements: 7, q35a_structure: 5, q36_social_energy: ['ambivert', 'introverted', 'extroverted'][i % 3],
    q36a_outgoing: 'ambivert', q37_empathy: 'very_high', q37a_harmony: 'high', q38_jealousy: 'very_low',
    q38a_emotional_reactive: 'low', q_emotional_pace: 1 + (i % 5), q_emotional_engagement: 3, q_independence_balance: 3,
    q_age_min: 21, q_age_max: 55, q_race_identity: ['any'], q_race_preference: ['any'],
  }
}

async function qaUsers() {
  const users: { id: string; email: string; label: string }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) if (u.user_metadata?.qa_test === QA_TAG) users.push({ id: u.id, email: u.email!, label: u.user_metadata.qa_label })
    if (data.users.length < 1000) break
  }
  return users.sort((a, b) => a.label.localeCompare(b.label))
}

async function seedMember(label: string, i: number, runTag: string, opts: { gated?: boolean; photo?: boolean; couple?: boolean; emailOverride?: string }) {
  const email = opts.emailOverride ?? `test-goose-${label.toLowerCase()}-${runTag}@qa.haevn.invalid`
  const fullName = `Gus TEST-GOOSE-${label}`
  const password = `Qa-${randomBytes(12).toString('base64url')}`
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, qa_test: QA_TAG, qa_label: label },
  })
  if (created.error) throw new Error(`createUser ${label}: ${created.error.message}`)
  const userId = created.data.user.id
  const now = new Date().toISOString()
  must(await admin.from('profiles').upsert({ user_id: userId, email, full_name: fullName, city: 'Austin' }, { onConflict: 'user_id' }), 'profiles')
  const p = must(await admin.from('partnerships').insert({
    owner_id: userId, profile_type: opts.couple ? 'couple' : 'solo', profile_state: 'draft', membership_tier: 'free', city: 'Austin',
    display_name: fullName, phone: null, notify_phone_invalid_at: now, notify_email_invalid_at: now,
  }).select('id').single(), 'partnerships') as { id: string }
  must(await admin.from('partnership_members').insert({ partnership_id: p.id, user_id: userId, role: 'owner' }), 'partnership_members')
  const a = opts.gated ? { ...answers(i), q9_intentions: ['Casual fun'] } : answers(i)
  must(await admin.from('user_survey_responses').upsert({
    user_id: userId, partnership_id: p.id, answers_json: a, completion_pct: 100, current_step: 0, completed_sections: COMPLETED_SECTIONS,
  }, { onConflict: 'user_id' }), 'user_survey_responses')
  if (opts.photo) {
    const path = `${p.id}/qa-goose-${label.toLowerCase()}.png`
    const up = await admin.storage.from(BUCKET).upload(path, PNG, { contentType: 'image/png', upsert: true })
    if (up.error) throw new Error(`photo upload: ${up.error.message}`)
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    must(await admin.from('partnership_photos').insert({ partnership_id: p.id, photo_url: url, photo_type: 'public', order_index: 0, is_primary: true }), 'partnership_photos')
  }
  return { label, userId, email, password, pid: p.id }
}

async function computedMatchesFingerprint() {
  const { count, error } = await admin.from('computed_matches').select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  const { data } = await admin.from('computed_matches').select('computed_at').order('computed_at', { ascending: false }).limit(1)
  return { rows: count ?? 0, newest_computed_at: data?.[0]?.computed_at ?? null }
}

/**
 * Member-block proof: sign in as a seeded QA member and query as the real
 * `authenticated` role (the access token in Authorization is what PostgREST
 * authorizes on). Every Goose table must read empty and refuse writes, and
 * both functions must refuse execution.
 */
async function memberRlsCheck(email: string, password: string, cohortId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const signer = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: session, error } = await signer.auth.signInWithPassword({ email, password })
  if (error || !session.session) throw new Error(`member sign-in failed: ${error?.message}`)
  const member = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
  })
  const rows = async (t: string) => {
    const r = await member.from(t).select('*').limit(5)
    return r.error ? `error: ${r.error.code}` : `${r.data.length} rows`
  }
  const svcProfiles = (await admin.from('profiles').select('*', { count: 'exact', head: true })).count ?? 0
  const memberProfiles = (await member.from('profiles').select('*', { count: 'exact', head: true })).count ?? 0
  const ins = await member.from('goose_cohorts').insert({ goose_event_id: `${EVENT_PREFIX}rls-${randomUUID()}`, event_starts_at: new Date().toISOString() })
  const cov = await member.rpc('goose_cohort_coverage', { p_cohort: cohortId })
  const fin = await member.rpc('goose_finalize_cohort', { p_cohort: cohortId, p_member_ids: [], p_population_hash: 'x' })
  await signer.auth.signOut().catch(() => {})
  return {
    role_is_member_scoped: memberProfiles < svcProfiles, // sanity: this client is NOT service role
    goose_cohorts: await rows('goose_cohorts'),
    goose_cohort_members: await rows('goose_cohort_members'),
    goose_pair_results: await rows('goose_pair_results'),
    insert_cohort: ins.error ? `refused (${ins.error.code})` : 'ACCEPTED — RLS FAILURE',
    rpc_coverage: cov.error ? `refused (${cov.error.code})` : 'EXECUTED — GRANT FAILURE',
    rpc_finalize: fin.error ? `refused (${fin.error.code})` : 'EXECUTED — GRANT FAILURE',
  }
}

/** Console transport: records alerts instead of emailing during a drill. */
function consoleTransport(log: string[]): AlertTransport {
  return async (to, subject) => {
    log.push(`${new Date().toISOString()} → ${to.replace(/^[^@]+/, '***')}: ${subject}`)
    return true
  }
}

async function run(n: number) {
  if (n < 3) throw new Error('--n must be >= 3')
  const existing = await qaUsers()
  if (existing.length > 0) throw new Error(`QA goose accounts already exist (${existing.length}); run --cleanup first`)
  const repo = createSupabaseGooseRepo(admin as never)
  const before = await computedMatchesFingerprint()
  const runTag = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)

  // N finalized members + 1 associated-only guest (association ≠ eligibility).
  const seeded = []
  for (let i = 0; i <= n; i++) {
    const label = String.fromCharCode(65 + i)
    seeded.push(await seedMember(label, i, runTag, { gated: i === n - 1, photo: i < 2 }))
  }
  const population = seeded.slice(0, n)
  const lateGuest = seeded[n]

  const created = await createCohort(repo, { goose_event_id: `${EVENT_PREFIX}${runTag}`, event_name: 'TEST Goose QA event', event_starts_at: new Date(Date.now() + 2 * 3600_000).toISOString() })
  const again = await createCohort(repo, { goose_event_id: `${EVENT_PREFIX}${runTag}`, event_starts_at: new Date().toISOString() })
  if (!created.ok || !again.ok) throw new Error('createCohort failed')
  const cohortId = created.haevn_cohort_id

  const assoc = []
  for (const [k, m] of seeded.entries()) {
    assoc.push(k === 0 ? await associateMember(repo, cohortId, { member_email: m.email.toUpperCase() }) : await associateMember(repo, cohortId, { member_id: m.pid }))
  }
  const reassoc = await associateMember(repo, cohortId, { member_id: seeded[1].pid })
  const notFound = await associateMember(repo, cohortId, { member_email: `nobody-${runTag}@qa.haevn.invalid` })

  const strayId = randomUUID()
  const rejected = await finalizeCohort(repo, cohortId, [...population.map((m) => m.pid), strayId])
  const afterReject = await repo.getCohort(cohortId)
  const fin = await finalizeCohort(repo, cohortId, population.map((m) => m.pid))
  if (!fin.ok) throw new Error(`finalize: ${fin.error}`)
  const t0 = Date.now()
  const first = await runGooseCompute(repo, cohortId, { transport: consoleTransport([]) })
  const wallMs = Date.now() - t0
  const status1 = await getCohortStatus(repo, cohortId)
  const results = await getCohortResults(repo, cohortId)
  const gatedPid = population[n - 1].pid
  const gatedSample = results?.pairs.find((p) => p.member_id_a === gatedPid || p.member_id_b === gatedPid)
  const photoSample = results?.pairs.find((p) => p.member_id_a === population[0].pid && p.member_id_b === population[1].pid)
    ?? results?.pairs.find((p) => p.photo_url_a || p.photo_url_b)

  // Live DB guarantees (each must be REJECTED or NOT COUNT).
  const cohortRow = await repo.getCohort(cohortId)
  const [x, y] = [population[0].pid, population[1].pid].sort()
  const base = { cohort_id: cohortId, finalization_id: cohortRow!.finalization_id, score: 50, band: 'meaningful_differences', gated: false, engine_version: 'qa' }
  const mirror = await admin.from('goose_pair_results').insert({ ...base, member_a: y, member_b: x })
  const dup = await admin.from('goose_pair_results').insert({ ...base, member_a: x, member_b: y })
  const [ox, oy] = [population[0].pid, lateGuest.pid].sort()
  const outsiderIns = await admin.from('goose_pair_results').insert({ ...base, member_a: ox, member_b: oy })
  const covWithOutsider = await repo.coverage(cohortId)
  await admin.from('goose_pair_results').delete().eq('cohort_id', cohortId).eq('member_a', ox).eq('member_b', oy)

  // Failure drill: re-finalize the same population (wipe), kill the write once.
  const alerts: string[] = []
  const drillRepo: GooseRepo = { ...repo }
  let failuresLeft = 1
  drillRepo.upsertResults = async (rows) => {
    if (failuresLeft-- > 0) throw new Error('QA drill: write killed mid-run')
    return repo.upsertResults(rows)
  }
  const fin2 = await finalizeCohort(repo, cohortId, population.map((m) => m.pid))
  const afterWipe = await repo.coverage(cohortId)
  const drill = await runGooseCompute(drillRepo, cohortId, process.argv.includes('--live-alerts') ? {} : { transport: consoleTransport(alerts), recipients: 'ops-a@qa.haevn.invalid,ops-b@qa.haevn.invalid' })
  const status2 = await getCohortStatus(repo, cohortId)
  const rls = await memberRlsCheck(population[0].email, population[0].password, cohortId)
  const after = await computedMatchesFingerprint()

  console.log(JSON.stringify({
    cohort: { haevn_cohort_id: cohortId, idempotent_create: created.haevn_cohort_id === again.haevn_cohort_id },
    association: {
      associated: assoc.filter((a) => a.ok).length,
      by_email_resolved: assoc[0].ok && assoc[0].member_id === seeded[0].pid,
      reassociation_same: JSON.stringify(reassoc) === JSON.stringify(assoc[1]),
      unknown_email: notFound,
      late_guest_associated_not_finalized: true,
    },
    finalize: {
      expected_pairs: fin.expected_pairs,
      never_associated_rejected: !rejected.ok && rejected.error === 'unknown_members' && JSON.stringify(rejected.unknown_member_ids) === JSON.stringify([strayId]),
      rejected_left_cohort_unfinalized: afterReject?.finalization_id === null && afterReject?.status === 'open',
    },
    compute: { outcome: first.outcome.kind, attempts: first.attempts, wall_ms_incl_io: wallMs, compute_ms: cohortRow?.last_compute_ms, pairs_written: cohortRow?.last_compute_pairs },
    status: status1,
    results: {
      pairs: results?.pairs.length,
      keys_exact: results?.pairs.every((p) => Object.keys(p).join() === GOOSE_RESULT_KEYS.join()),
      forbidden_keys: findForbiddenGooseKeys(results),
      score_spread: [...new Set(results?.pairs.map((p) => p.compatibility_pct))].sort((a, b) => a - b),
      hard_gated_sample: gatedSample,
      photo_sample: photoSample,
    },
    db_guarantees: {
      mirror_insert_rejected: !!mirror.error,
      duplicate_insert_rejected: !!dup.error,
      outsider_insert_accepted_but_not_counted: !outsiderIns.error && covWithOutsider.completed_pairs === covWithOutsider.expected_pairs,
      coverage_with_outsider: covWithOutsider,
    },
    failure_drill: {
      refinalize_wiped_to: afterWipe.completed_pairs,
      new_finalization: fin2.ok && fin2.finalization_id !== cohortRow?.finalization_id,
      outcome: drill.outcome.kind,
      attempts: drill.attempts,
      alert: drill.alert,
      recovered_email: drill.recovered,
      alerts_logged: alerts,
      status_after: status2,
    },
    member_rls: rls,
    computed_matches: { before, after, untouched: JSON.stringify(before) === JSON.stringify(after) },
  }, null, 2))
}

async function cleanup() {
  const { data: cohorts } = await admin.from('goose_cohorts').select('id').like('goose_event_id', `${EVENT_PREFIX}%`)
  const cohortIds = (cohorts ?? []).map((c: { id: string }) => c.id)
  if (cohortIds.length) must(await admin.from('goose_cohorts').delete().in('id', cohortIds), 'goose_cohorts')
  let events = 0
  for (const id of cohortIds) {
    const { data } = await admin.from('system_events').delete().like('event_type', 'goose_%').eq('metadata->>cohort_id', id).select('id')
    events += data?.length ?? 0
  }
  const users = await qaUsers()
  for (const u of users) {
    const links = must(await admin.from('partnership_members').select('partnership_id').eq('user_id', u.id), 'links') as Array<{ partnership_id: string }>
    for (const { partnership_id: pid } of links) {
      const files = await admin.storage.from(BUCKET).list(pid)
      if (files.data?.length) await admin.storage.from(BUCKET).remove(files.data.map((f) => `${pid}/${f.name}`))
      must(await admin.from('user_survey_responses').delete().eq('partnership_id', pid), 'surveys')
      must(await admin.from('partnership_photos').delete().eq('partnership_id', pid), 'photos')
      must(await admin.from('partnership_members').delete().eq('partnership_id', pid), 'members')
      must(await admin.from('partnerships').delete().eq('id', pid), 'partnerships')
    }
    must(await admin.from('user_survey_responses').delete().eq('user_id', u.id), 'surveys by user')
    must(await admin.from('profiles').delete().eq('user_id', u.id), 'profiles')
    const del = await admin.auth.admin.deleteUser(u.id)
    if (del.error) throw new Error(`deleteUser ${u.label}: ${del.error.message}`)
  }
  const { count: left } = await admin.from('goose_cohorts').select('*', { count: 'exact', head: true })
  console.log(JSON.stringify({ cohorts_removed: cohortIds.length, goose_events_removed: events, qa_users_removed: users.length, qa_users_left: (await qaUsers()).length, goose_cohorts_remaining_total: left }, null, 2))
}

/** READ-ONLY: score stored weekly pairs through the cohort input path; compare. */
async function parity(limit: number) {
  const repo = createSupabaseGooseRepo(admin as never)
  const { data, error } = await admin.from('computed_matches').select('partnership_a, partnership_b, score, engine_version').eq('engine_version', '5cat-v6').limit(limit)
  if (error) throw new Error(error.message)
  const rows = data as Array<{ partnership_a: string; partnership_b: string; score: number }>
  const ids = [...new Set(rows.flatMap((r) => [r.partnership_a, r.partnership_b]))]
  const { inputs } = await repo.loadScorableMembers(ids)
  let same = 0, differ = 0, unscorable = 0, asymmetric = 0
  for (const r of rows) {
    const a = inputs.get(r.partnership_a), b = inputs.get(r.partnership_b)
    if (!a || !b) { unscorable++; continue }
    const ab = scorePair(a, b).score, ba = scorePair(b, a).score
    if (ab !== ba) asymmetric++
    if (ab === r.score || ba === r.score) same++
    else differ++
  }
  // Counts only — a difference means the survey changed since Monday's run, not a scorer divergence.
  console.log(JSON.stringify({ compared: rows.length, same, differ, unscorable, asymmetric }, null, 2))
}

// ── Joint test (partner conformance run) ──────────────────────────────────────

const JOINT_TAG = 'joint'

/**
 * 6 singles + 1 couple = 8 emails, 7 member_ids. Stable, readable emails. Single
 * S6 is deliberately hard-gated (no shared connection intent) so the partner
 * sees a real 0% / long-shot pair; S1 and the couple carry a primary photo so
 * both photo_url states appear. No cohort is created — the partner drives that.
 */
async function seedJoint(domain = 'qa.haevn.invalid') {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new Error(`bad --domain ${domain}`)
  const existing = await qaUsers()
  if (existing.length > 0) throw new Error(`QA goose accounts already exist (${existing.length}); run --cleanup first`)
  const singles = []
  for (let i = 1; i <= 6; i++) {
    singles.push(await seedMember(`S${i}`, i, JOINT_TAG, { gated: i === 6, photo: i === 1, emailOverride: `test-goose-joint-s${i}@${domain}` }))
  }
  const owner = await seedMember('C1A', 7, JOINT_TAG, { photo: true, couple: true, emailOverride: `test-goose-joint-c1a@${domain}` })
  const partner = await addCouplePartner(owner.pid, 'C1B', `test-goose-joint-c1b@${domain}`)
  console.log(JSON.stringify({
    singles: singles.map((m) => ({ email: m.email, member_id: m.pid, ...(m.label === 'S6' ? { note: 'hard-gated: every pair with S6 scores 0' } : {}), ...(m.label === 'S1' ? { note: 'has a primary photo' } : {}) })),
    couple: { member_id: owner.pid, emails: [owner.email, partner.email], note: 'one partnership, two people; both emails resolve to this member_id; has a primary photo' },
  }, null, 2))
  await verifyJoint()
}

/** Second person of a couple: own login + profile, joined to the owner's partnership as 'member'. */
async function addCouplePartner(pid: string, label: string, email: string) {
  const fullName = `Gus TEST-GOOSE-${label}`
  const created = await admin.auth.admin.createUser({
    email, password: `Qa-${randomBytes(12).toString('base64url')}`, email_confirm: true,
    user_metadata: { full_name: fullName, qa_test: QA_TAG, qa_label: label },
  })
  if (created.error) throw new Error(`createUser ${label}: ${created.error.message}`)
  const userId = created.data.user.id
  must(await admin.from('profiles').upsert({ user_id: userId, email, full_name: fullName }, { onConflict: 'user_id' }), 'profiles')
  must(await admin.from('partnership_members').insert({ partnership_id: pid, user_id: userId, role: 'member' }), 'partnership_members')
  return { label, userId, email }
}

/** Every seeded email through the exact resolution association uses (no cohort written). */
async function verifyJoint() {
  const repo = createSupabaseGooseRepo(admin as never)
  const users = await qaUsers()
  const rows = []
  for (const u of users) {
    const memberId = await repo.findMemberIdByEmail(u.email)
    const upper = await repo.findMemberIdByEmail(u.email.toUpperCase())
    rows.push({
      email: u.email,
      member_id: memberId,
      resolves: !!memberId && (await repo.partnershipExists(memberId)),
      case_insensitive: upper === memberId,
      survey_complete: memberId ? await repo.hasCompletedSurvey(memberId) : false,
    })
  }
  const ids = [...new Set(rows.map((r) => r.member_id))]
  const photos = await repo.primaryPhotos(ids.filter(Boolean) as string[])
  const couple = rows.filter((r) => /-c1[ab]@/.test(r.email))
  console.log(JSON.stringify({
    verify: rows,
    emails: rows.length,
    distinct_member_ids: ids.length,
    all_resolve: rows.every((r) => r.resolves && r.case_insensitive && r.survey_complete),
    couple_shares_one_member_id: couple.length === 2 && couple[0].member_id === couple[1].member_id,
    members_with_photo: photos.size,
    expected_pairs_if_all_7_finalized: (ids.length * (ids.length - 1)) / 2,
  }, null, 2))
}

/** Joint-test failure drill: survey completion 100 → 99 (drop) or back to 100 (restore). QA members only. */
async function drill(kind: 'drop' | 'restore', memberId: string) {
  const users = await qaUsers()
  const links = must(await admin.from('partnership_members').select('user_id, role').eq('partnership_id', memberId), 'links') as Array<{ user_id: string; role: string }>
  const owner = links.find((l) => l.role === 'owner')
  if (!owner || !users.some((u) => u.id === owner.user_id)) throw new Error('refusing: not a QA goose member')
  const pct = kind === 'drop' ? 99 : 100
  must(await admin.from('user_survey_responses').update({ completion_pct: pct }).eq('user_id', owner.user_id), 'survey update')
  const repo = createSupabaseGooseRepo(admin as never)
  console.log(JSON.stringify({ drill: kind, member_id: memberId, completion_pct: pct, survey_complete_now: await repo.hasCompletedSurvey(memberId), at: new Date().toISOString() }))
}

/** Redact anything email-shaped and the bearer token from a transcript value. */
function redact(v: unknown, secret: string): unknown {
  return JSON.parse(JSON.stringify(v).split(secret).join('***').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email redacted>'))
}

/** Full lifecycle over real HTTPS — the joint-test path the event partner will use. */
async function http(baseUrl: string, n = 6) {
  const secret = process.env.GOOSE_SHARED_SECRET
  if (!secret) throw new Error('GOOSE_SHARED_SECRET not in .env.local')
  const existing = await qaUsers()
  if (existing.length > 0) throw new Error(`QA goose accounts already exist (${existing.length}); run --cleanup first`)
  const api = `${baseUrl.replace(/\/+$/, '')}/api/goose`
  const transcript: unknown[] = []
  async function call(method: string, path: string, body?: unknown, token: string | null = secret!) {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (token !== null) headers.authorization = `Bearer ${token}`
    const t0 = Date.now()
    const res = await fetch(`${api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    const parsed = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : ''
    transcript.push(redact({ request: `${method} /api/goose${path}`, auth: token === null ? 'none' : token === secret ? 'Bearer ***' : 'Bearer <wrong>', body, status: res.status, ms: Date.now() - t0, response: parsed }, secret!))
    return { status: res.status, body: parsed as any }
  }

  const before = await computedMatchesFingerprint()
  const runTag = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
  const members = []
  for (let i = 0; i < n; i++) members.push(await seedMember(String.fromCharCode(65 + i), i, runTag, { gated: i === n - 1, photo: i < 2 }))
  const eventId = `${EVENT_PREFIX}http-${runTag}`
  const startsAt = new Date(Date.now() + 2 * 3600_000).toISOString().replace('Z', '+00:00')

  const c1 = await call('POST', '/cohorts', { goose_event_id: eventId, event_name: 'TEST Goose HTTPS proof', event_starts_at: startsAt })
  const c2 = await call('POST', '/cohorts', { goose_event_id: eventId, event_name: 'TEST Goose HTTPS proof', event_starts_at: startsAt })
  const id = c1.body.haevn_cohort_id as string
  for (const m of members) await call('POST', `/cohorts/${id}/members`, { member_email: m.email })
  await call('POST', `/cohorts/${id}/members`, { member_email: members[0].email }) // idempotent repeat
  const fin = await call('POST', `/cohorts/${id}/finalize`, { member_ids: members.map((m) => m.pid) })
  let st = await call('GET', `/cohorts/${id}/status`)
  for (let i = 0; i < 20 && st.body.status === 'processing'; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    st = await call('GET', `/cohorts/${id}/status`)
  }
  const res = await call('GET', `/cohorts/${id}/results`)
  // Keep the transcript readable: the results entry shows 2 sample rows.
  const resEntry = transcript[transcript.length - 1] as any
  resEntry.response = { status: resEntry.response.status, pairs_count: resEntry.response.pairs?.length, sample_pairs: resEntry.response.pairs?.slice(0, 2), gated_sample: resEntry.response.pairs?.find((p: any) => p.compatibility_pct === 0) }

  // Negative proofs.
  const noTok = await call('GET', `/cohorts/${id}/status`, undefined, null)
  const wrongTok = await call('GET', `/cohorts/${id}/status`, undefined, 'definitely-not-the-secret')
  const c3 = await call('POST', '/cohorts', { goose_event_id: eventId, event_name: 'TEST Goose HTTPS proof', event_starts_at: startsAt })
  const unknownCohort = await call('GET', `/cohorts/${randomUUID()}/status`)
  const stray = randomUUID()
  const badFinalize = await call('POST', `/cohorts/${id}/finalize`, { member_ids: [...members.map((m) => m.pid), stray] })
  const stillReady = await call('GET', `/cohorts/${id}/status`)
  const unknownMember = await call('POST', `/cohorts/${id}/members`, { member_email: `nobody-${runTag}@qa.haevn.invalid` })
  const malformed = await call('POST', '/cohorts', { goose_event_id: eventId, event_starts_at: '2026-12-31T20:00:00' })
  const after = await computedMatchesFingerprint()

  const pairs = res.body.pairs as any[]
  console.log(JSON.stringify({ transcript }, null, 2))
  console.log(JSON.stringify({
    summary: {
      same_cohort_id_on_repeat_create: c1.body.haevn_cohort_id === c2.body.haevn_cohort_id && c2.body.haevn_cohort_id === c3.body.haevn_cohort_id,
      finalize: fin.body,
      final_status: st.body,
      results: { status: res.body.status, pairs: pairs.length, every_row_exactly_8_contract_keys: pairs.every((p) => Object.keys(p).join() === GOOSE_RESULT_KEYS.join()), forbidden_keys: findForbiddenGooseKeys(res.body) },
      negatives: {
        no_token: [noTok.status, noTok.body], wrong_token: [wrongTok.status, wrongTok.body],
        unknown_cohort: [unknownCohort.status, unknownCohort.body],
        never_associated_finalize: [badFinalize.status, badFinalize.body.error, badFinalize.body.unknown_member_ids?.length === 1 && badFinalize.body.unknown_member_ids[0] === stray],
        population_unchanged_after_rejection: [stillReady.body.status, stillReady.body.expected_pairs],
        unknown_member: [unknownMember.status, unknownMember.body], malformed_timestamp: [malformed.status, malformed.body],
      },
      computed_matches: { before, after, untouched: JSON.stringify(before) === JSON.stringify(after) },
    },
  }, null, 2))
}

async function main() {
  const argv = process.argv
  const dom = argv.indexOf('--domain')
  if (argv.includes('--seed-joint')) return seedJoint(dom > 0 ? argv[dom + 1] : undefined)
  if (argv.includes('--verify-joint')) return verifyJoint()
  for (const kind of ['drop', 'restore'] as const) {
    const i = argv.indexOf(`--drill-${kind}`)
    if (i > 0) return drill(kind, argv[i + 1])
  }
  const h = argv.indexOf('--http')
  if (h > 0) return http(argv[h + 1] ?? 'https://www.haevn.app')
  if (argv.includes('--cleanup')) return cleanup()
  const p = argv.indexOf('--parity')
  if (p > 0) return parity(Number(argv[p + 1] ?? 200))
  const nArg = argv.indexOf('--n')
  return run(nArg > 0 ? Number(argv[nArg + 1]) : 6)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
