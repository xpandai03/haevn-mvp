/**
 * 6-case verification for POST /api/ingest/survey (completion_v1 receiver).
 *
 * ⚠️ SAFE TO RUN AGAINST PRODUCTION. Containment is enforced, not assumed:
 *
 *  1. IDENTITY — every test user is @haevn-ingest-test.invalid (an unroutable
 *     RFC-2606 TLD: no real mail can ever reach it) and is tagged
 *     user_metadata.test_ingest = true immediately after creation, so leftovers
 *     are trivially findable and bulk-removable.
 *
 *  2. NEVER IN THE MATCH POOL — every payload deliberately OMITS location.city,
 *     so the receiver assigns the 'Unknown' sentinel, which resolves to NO
 *     market => withheld by the live city gate. No test payload uses Austin or
 *     any live market. Case (f) asserts withheld via BOTH the endpoint response
 *     and the real gate (isCityLive) read back from the DB.
 *
 *  3. CLEANUP IS VERIFIED, not hoped for — after the run we delete every
 *     artifact (auth user, profiles, partnerships, members, survey responses,
 *     photos rows, storage objects, ingest-log rows) and then RE-QUERY each
 *     table to prove zero test rows remain. Anything left is reported loudly.
 *
 *  4. Real users are strictly read-only. Every write is scoped to ids this
 *     script created.
 *
 * Usage:
 *   HAEVN_INGEST_SECRET=<secret> npx tsx scripts/test-survey-ingest.ts \
 *     --url https://www.haevn.app [--no-cleanup]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createHmac, randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { loadMarketIndex, isCityLive } from '../lib/markets/releaseGate'

const argv = process.argv
const BASE = argv.includes('--url') ? argv[argv.indexOf('--url') + 1] : 'https://www.haevn.app'
const ENDPOINT = `${BASE}/api/ingest/survey`
const CLEANUP = !argv.includes('--no-cleanup')
const SECRET = process.env.HAEVN_INGEST_SECRET || ''
const TEST_DOMAIN = 'haevn-ingest-test.invalid'
/** A real, fetchable image on our own domain — proves the fetch->storage path
 *  without reaching into the survey app's tokenized URLs. */
const TEST_PHOTO_URL = `${BASE}/images/haevn-logo-transparent.png`

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let pass = 0, fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

const sign = (body: string, ts: number) =>
  'sha256=' + createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex')

async function post(payload: any, opts: { ts?: number; badSig?: boolean } = {}) {
  const body = JSON.stringify(payload)
  const ts = opts.ts ?? Math.floor(Date.now() / 1000)
  const sig = opts.badSig ? 'sha256=' + 'deadbeef'.repeat(8) : sign(body, ts)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HAEVN-Signature': sig, 'X-HAEVN-Timestamp': String(ts) },
    body,
  })
  let json: any = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

/**
 * CONTAINED payload. NOTE: location.city is deliberately OMITTED on every test
 * payload -> receiver assigns the 'Unknown' sentinel -> resolves to no market ->
 * withheld. A test user must never be release-eligible.
 */
function makePayload(over: Partial<any> = {}): any {
  const id = randomUUID()
  return {
    event: 'survey.completed',
    event_id: id,
    occurred_at: new Date().toISOString(),
    survey_version: '2.0.0',
    submission_id: id,
    identity: {
      email: `ingest-test-${id.slice(0, 8)}@${TEST_DOMAIN}`,
      mobile: '+15125550123',
      first_name: 'Ingest',
      last_name: 'Tester',
    },
    // NO city -> sentinel -> withheld. NEVER Austin, never a live market.
    location: { zip: null, city: null, state: null, market: 'TEST-DO-NOT-RELEASE' },
    attribution: { source: 'ingest-test', medium: 'script' },
    quality: { score: 90, flags: [], time_spent_seconds: 600, honeypot_triggered: false },
    photos: [],
    answers: {
      Q0_INTENT: 'dating',
      Q0_JOIN: 'couple',
      Q1: { month: 6, day: 30, year: 1990, age: 36 },
      Q2: { selected: 'man', other_text: null },
      Q3: 'bi',
      Q6: ['enm', 'open'],
      Q9: ['lt', 'st'],
      Q20: '3',
      // Conditional-skip: Q3a/Q3b/Q6c/Q6d/Q42/Q43/Q44 deliberately ABSENT.
    },
    timestamps: { started_at: new Date(Date.now() - 6e5).toISOString(), submitted_at: new Date().toISOString() },
    ...over,
  }
}

const createdUsers: string[] = []
const createdParts: string[] = []
const submissionIds: string[] = []

/** Tag a created test user so leftovers are unmistakable in prod. */
async function tagTestUser(userId: string) {
  const { data } = await sb.auth.admin.getUserById(userId)
  await sb.auth.admin.updateUserById(userId, {
    user_metadata: { ...(data.user?.user_metadata ?? {}), test_ingest: true },
  })
}

async function track(json: any) {
  if (json?.user_id) { createdUsers.push(json.user_id); await tagTestUser(json.user_id) }
  if (json?.member_id) createdParts.push(json.member_id)
}

async function main() {
  console.log(`\nTarget: ${ENDPOINT}`)
  console.log(`Containment: all payloads city=OMITTED -> 'Unknown' sentinel -> WITHHELD (never the match pool)\n`)
  if (!SECRET) { console.error('❌ HAEVN_INGEST_SECRET not set — cannot sign. Aborting (no calls made).'); process.exit(1) }

  // Baseline counts (to prove cleanup restores exactly)
  const baseline = {
    users: 0,
    parts: (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0,
    log: (await sb.from('survey_ingest_log').select('submission_id', { count: 'exact', head: true })).count ?? 0,
  }
  console.log(`Baseline: partnerships=${baseline.parts} ingest_log=${baseline.log}`)

  // ── (a) valid signed payload -> created, withheld, photo fetched
  console.log('\n=== (a) Valid signed payload -> 200 created ===')
  const pa = makePayload({ photos: [{ photo_id: 'p1', is_primary: true, url: TEST_PHOTO_URL }] })
  submissionIds.push(pa.submission_id)
  const ra = await post(pa)
  check('200 + status=created', ra.status === 200 && ra.json?.status === 'created', `got ${ra.status} ${ra.json?.status ?? ra.json?.detail ?? ''}`)
  await track(ra.json)
  check("city = 'Unknown' sentinel (NOT Austin)", ra.json?.city === 'Unknown', `got "${ra.json?.city}"`)
  check('🔒 WITHHELD: market_live=false', ra.json?.market_live === false, `market_live=${ra.json?.market_live}`)
  check('photo fetched into storage', ra.json?.photos_imported === 1, `imported=${ra.json?.photos_imported}`)

  if (ra.json?.member_id) {
    const { data: part } = await sb.from('partnerships').select('city, phone, profile_state, membership_tier, profile_type').eq('id', ra.json.member_id).maybeSingle()
    check('phone carried', (part as any)?.phone === '+15125550123', `got ${(part as any)?.phone}`)
    check('Q0_JOIN=couple -> profile_type=couple', (part as any)?.profile_type === 'couple', `got ${(part as any)?.profile_type}`)
    check("profile_state='live', tier='free'", (part as any)?.profile_state === 'live' && (part as any)?.membership_tier === 'free')
    const { data: surv } = await sb.from('user_survey_responses').select('answers_json, completion_pct').eq('user_id', ra.json.user_id).maybeSingle()
    const A = (surv as any)?.answers_json ?? {}
    check('Q2 -> q2_gender_identity (unwrapped)', A.q2_gender_identity === 'man', `got ${JSON.stringify(A.q2_gender_identity)}`)
    check('Q1 -> q1_age ISO', A.q1_age === '1990-06-30', `got ${A.q1_age}`)
    check('Q20 -> numeric 3', A.q20_discretion === 3)
    check('completion_pct=100', (surv as any)?.completion_pct === 100)
    const { data: ph } = await sb.from('partnership_photos').select('photo_url, is_primary').eq('partnership_id', ra.json.member_id)
    check('photo row written (is_primary)', (ph?.length ?? 0) === 1 && (ph as any)[0].is_primary === true)
  }

  // ── (b) idempotency
  console.log('\n=== (b) Re-POST same submission_id -> duplicate, NO 2nd user ===')
  const partsBefore = (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0
  const rb = await post(pa)
  const partsAfter = (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0
  check('200 + status=duplicate', rb.status === 200 && rb.json?.status === 'duplicate', `got ${rb.status} ${rb.json?.status}`)
  check('🔒 NO second user (idempotent)', partsBefore === partsAfter, `partnerships ${partsBefore} -> ${partsAfter}`)
  check('same member_id echoed', rb.json?.member_id === ra.json?.member_id)

  // ── (c) bad signature
  console.log('\n=== (c) Bad signature -> 401 ===')
  const rc = await post(makePayload(), { badSig: true })
  check('401', rc.status === 401, `got ${rc.status}`)
  check('no user created', !rc.json?.user_id)

  // ── (d) stale timestamp
  console.log('\n=== (d) Stale timestamp (>5 min) -> 401 ===')
  const rd = await post(makePayload(), { ts: Math.floor(Date.now() / 1000) - 600 })
  check('401', rd.status === 401, `got ${rd.status} ${rd.json?.detail ?? ''}`)

  // ── (e) sparse answers / photos:[] / missing Q0_JOIN
  console.log('\n=== (e) Sparse answers + photos:[] -> 200; missing Q0_JOIN -> flagged ===')
  const pe = makePayload({ photos: [], answers: { Q0_JOIN: 'solo', Q2: { selected: 'woman' }, Q9: ['lt'] } })
  submissionIds.push(pe.submission_id)
  const re_ = await post(pe)
  check('200 created (tolerates conditional-skip)', re_.status === 200 && re_.json?.status === 'created', `got ${re_.status} ${re_.json?.detail ?? ''}`)
  await track(re_.json)
  check('needs_review=false (Q0_JOIN present)', re_.json?.needs_review === false)

  const pe2 = makePayload({ answers: { Q0_INTENT: 'dating', Q2: { selected: 'man' }, Q9: ['lt'] } })
  submissionIds.push(pe2.submission_id)
  const re2 = await post(pe2)
  check('200 created (Q0_JOIN missing)', re2.status === 200 && re2.json?.status === 'created')
  await track(re2.json)
  check('🚩 needs_review=true (NOT silently solo)', re2.json?.needs_review === true, `got ${re2.json?.needs_review}`)

  const rmal = await post({ event: 'survey.completed', submission_id: randomUUID(), identity: { email: 'not-an-email' }, answers: {} })
  check('malformed -> 400 (not silent 200)', rmal.status === 400, `got ${rmal.status}`)

  // ── (f) gating: prove withheld via the REAL gate, read back from the DB
  console.log('\n=== (f) 🔒 GATING: every test user WITHHELD (real gate, live env) ===')
  const idx = await loadMarketIndex(true)
  let allWithheld = true
  for (const pid of createdParts) {
    const { data: p } = await sb.from('partnerships').select('city').eq('id', pid).maybeSingle()
    const city = (p as any)?.city
    const live = isCityLive(city, idx)
    if (live) allWithheld = false
    console.log(`    partnership ${pid.slice(0, 8)} city="${city}" -> isCityLive=${live}`)
  }
  check('🔒 NO test user is release-eligible', allWithheld && createdParts.length > 0, `${createdParts.length} test partnerships checked`)
  // and none appear in computed_matches (never entered the pool)
  const { data: cmRows } = await sb.from('computed_matches').select('partnership_a').in('partnership_a', createdParts.length ? createdParts : ['00000000-0000-0000-0000-000000000000'])
  check('🔒 NO test user in computed_matches (match pool clean)', (cmRows?.length ?? 0) === 0, `${cmRows?.length} rows`)

  // ── audit
  console.log('\n=== Audit trail ===')
  const { data: logs } = await sb.from('survey_ingest_log').select('submission_id, result, resolved_city, market_resolved, needs_review').in('submission_id', submissionIds)
  check('every ingest logged', (logs?.length ?? 0) === submissionIds.length, `${logs?.length}/${submissionIds.length}`)
  for (const l of (logs ?? []) as any[]) console.log(`    ${String(l.result).padEnd(8)} city="${l.resolved_city}" market_live=${l.market_resolved} review=${l.needs_review}`)

  // ── CLEANUP (mandatory + verified)
  if (CLEANUP) {
    console.log(`\n=== CLEANUP: removing ${createdUsers.length} test users + artifacts ===`)
    for (const pid of createdParts) {
      // storage objects first (photos fetched during the test)
      const { data: objs } = await sb.storage.from('public-photos').list(pid)
      if (objs?.length) await sb.storage.from('public-photos').remove(objs.map((o) => `${pid}/${o.name}`))
      await sb.from('partnership_photos').delete().eq('partnership_id', pid)
      await sb.from('partnership_members').delete().eq('partnership_id', pid)
    }
    for (const uid of createdUsers) {
      await sb.from('user_survey_responses').delete().eq('user_id', uid)
      await sb.from('profiles').delete().eq('user_id', uid)
      await sb.from('partnerships').delete().eq('owner_id', uid)
      await sb.auth.admin.deleteUser(uid)
    }
    if (submissionIds.length) await sb.from('survey_ingest_log').delete().in('submission_id', submissionIds)

    // VERIFY cleanup — re-query every table
    console.log('\n=== CLEANUP VERIFICATION (must all be 0) ===')
    let leftovers = 0
    const stillUsers: string[] = []
    let page = 1
    while (true) {
      const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
      for (const u of data.users) {
        if (u.email?.endsWith(TEST_DOMAIN) || (u.user_metadata as any)?.test_ingest === true) stillUsers.push(u.email || u.id)
      }
      if (data.users.length < 1000) break
      page++
    }
    const q = async (t: string, col: string, ids: string[]) => {
      if (!ids.length) return 0
      const { count } = await sb.from(t).select(col, { count: 'exact', head: true }).in(col, ids)
      return count ?? 0
    }
    const leftParts = await q('partnerships', 'id', createdParts)
    const leftMembers = await q('partnership_members', 'partnership_id', createdParts)
    const leftPhotos = await q('partnership_photos', 'partnership_id', createdParts)
    const leftSurvey = await q('user_survey_responses', 'user_id', createdUsers)
    const leftProfiles = await q('profiles', 'user_id', createdUsers)
    const leftLog = submissionIds.length ? ((await sb.from('survey_ingest_log').select('submission_id', { count: 'exact', head: true }).in('submission_id', submissionIds)).count ?? 0) : 0
    let leftStorage = 0
    for (const pid of createdParts) {
      const { data: objs } = await sb.storage.from('public-photos').list(pid)
      leftStorage += objs?.length ?? 0
    }
    const rows: Array<[string, number]> = [
      ['auth users (test)', stillUsers.length], ['partnerships', leftParts], ['partnership_members', leftMembers],
      ['partnership_photos', leftPhotos], ['user_survey_responses', leftSurvey], ['profiles', leftProfiles],
      ['survey_ingest_log', leftLog], ['storage objects', leftStorage],
    ]
    for (const [n, c] of rows) { console.log(`  ${c === 0 ? '✅' : '❌'} ${n.padEnd(24)} remaining=${c}`); leftovers += c }
    if (stillUsers.length) console.log('  ORPHANS:', stillUsers.join(', '))
    check('🧹 CLEANUP COMPLETE — zero test rows remain', leftovers === 0, `${leftovers} leftover row(s)`)

    const finalParts = (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0
    const finalLog = (await sb.from('survey_ingest_log').select('submission_id', { count: 'exact', head: true })).count ?? 0
    console.log(`\n  partnerships: ${baseline.parts} (before) -> ${finalParts} (after)  ${baseline.parts === finalParts ? '✅ restored' : '❌ DRIFT'}`)
    console.log(`  ingest_log:   ${baseline.log} (before) -> ${finalLog} (after)  ${baseline.log === finalLog ? '✅ restored' : '❌ DRIFT'}`)
    if (baseline.parts !== finalParts || baseline.log !== finalLog) fail++
  }

  console.log(`\n${'='.repeat(56)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(56)}`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
