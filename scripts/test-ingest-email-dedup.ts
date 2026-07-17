/**
 * Email-dedup hardening verification (3 cases). SAFE ON PROD — contained +
 * self-cleaning, same conventions as scripts/test-survey-ingest.ts:
 *   - @haevn-ingest-test.invalid emails, user_metadata.test_ingest=true
 *   - every payload omits location.city -> 'Unknown' sentinel -> WITHHELD
 *   - all artifacts deleted + re-queried to prove zero remain
 *
 * Cases:
 *   (a) completion whose EMAIL matches an existing partnership -> 200 duplicate
 *       (dedupe=email_exists), NO new user, logged.
 *   (b) brand-new email + new submission_id -> 200 created.
 *   (c) re-POST the same submission_id -> 200 duplicate (existing path intact).
 *
 * Usage:
 *   HAEVN_INGEST_SECRET=<value> npx tsx scripts/test-ingest-email-dedup.ts --url https://www.haevn.app
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createHmac, randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv
const BASE = argv.includes('--url') ? argv[argv.indexOf('--url') + 1] : 'https://www.haevn.app'
const ENDPOINT = `${BASE}/api/ingest/survey`
const SECRET = process.env.HAEVN_INGEST_SECRET || ''
const TEST_DOMAIN = 'haevn-ingest-test.invalid'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})
let pass = 0, fail = 0
const check = (n: string, ok: boolean, d = '') => { console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++ }
const sign = (b: string, ts: number) => 'sha256=' + createHmac('sha256', SECRET).update(`${ts}.${b}`).digest('hex')

async function post(payload: any) {
  const body = JSON.stringify(payload)
  const ts = Math.floor(Date.now() / 1000)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-HAEVN-Signature': sign(body, ts), 'X-HAEVN-Timestamp': String(ts) },
    body,
  })
  let json: any = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}
function payload(email: string, over: Partial<any> = {}) {
  const id = randomUUID()
  return {
    event: 'survey.completed', event_id: id, submission_id: id,
    identity: { email, mobile: '+15125550199', first_name: 'Dedup', last_name: 'Probe' },
    location: { city: null, market: 'TEST-DO-NOT-RELEASE' }, // withheld
    quality: { flags: [] }, photos: [],
    answers: { Q0_JOIN: 'solo', Q2: { selected: 'man' }, Q3: 'bi', Q9: ['lt'], Q1: { month: 6, day: 30, year: 1990 } },
    ...over,
  }
}

const users: string[] = []
const parts: string[] = []
const subs: string[] = []
async function tag(uid: string) {
  const { data } = await sb.auth.admin.getUserById(uid)
  await sb.auth.admin.updateUserById(uid, { user_metadata: { ...(data.user?.user_metadata ?? {}), test_ingest: true } })
}
async function track(j: any) { if (j?.user_id && !users.includes(j.user_id)) { users.push(j.user_id); await tag(j.user_id) } if (j?.member_id && !parts.includes(j.member_id)) parts.push(j.member_id) }

async function main() {
  console.log(`\nTarget: ${ENDPOINT}`)
  if (!SECRET) { console.error('❌ HAEVN_INGEST_SECRET not set'); process.exit(1) }
  const before = (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0
  console.log(`Baseline partnerships: ${before}`)

  const email = `dedup-${randomUUID().slice(0, 8)}@${TEST_DOMAIN}`

  // Seed an "existing" partnership for that email.
  console.log('\n=== seed: create the existing partnership ===')
  const seed = payload(email); subs.push(seed.submission_id)
  const r0 = await post(seed); await track(r0.json)
  check('seed created', r0.status === 200 && r0.json?.status === 'created', `${r0.status} ${r0.json?.status}`)

  // (a) SAME email, DIFFERENT submission_id -> duplicate by email
  console.log('\n=== (a) existing EMAIL, new submission_id -> duplicate (email_exists) ===')
  const dupe = payload(email, { identity: { email, mobile: '+15125550200', first_name: 'Should', last_name: 'Notdupe' } })
  subs.push(dupe.submission_id)
  const pBefore = (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0
  const ra = await post(dupe)
  const pAfter = (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0
  check('200 + status=duplicate', ra.status === 200 && ra.json?.status === 'duplicate', `${ra.status} ${ra.json?.status}`)
  check('dedupe=email_exists', ra.json?.dedupe === 'email_exists', `got ${ra.json?.dedupe}`)
  check('🔒 NO new partnership created', pBefore === pAfter, `${pBefore} -> ${pAfter}`)
  check('member_id = the EXISTING partnership', ra.json?.member_id === r0.json?.member_id, `${ra.json?.member_id}`)
  const { data: logA } = await sb.from('survey_ingest_log').select('result, reason').eq('submission_id', dupe.submission_id).maybeSingle()
  check('logged result=duplicate reason=email_exists', (logA as any)?.result === 'duplicate' && (logA as any)?.reason === 'email_exists', JSON.stringify(logA))
  // and it did NOT overwrite the existing user's phone with the new one
  const { data: seedPart } = await sb.from('partnerships').select('phone').eq('id', r0.json.member_id).maybeSingle()
  check('existing user NOT overwritten (phone unchanged)', (seedPart as any)?.phone === '+15125550199', `phone=${(seedPart as any)?.phone}`)

  // (b) brand-new email -> created
  console.log('\n=== (b) new email + new submission_id -> created ===')
  const p2 = payload(`dedup-${randomUUID().slice(0, 8)}@${TEST_DOMAIN}`); subs.push(p2.submission_id)
  const rb = await post(p2); await track(rb.json)
  check('200 + status=created', rb.status === 200 && rb.json?.status === 'created', `${rb.status} ${rb.json?.status}`)

  // (c) same submission_id -> duplicate (existing submission_id path intact)
  console.log('\n=== (c) re-POST same submission_id -> duplicate (submission_id path) ===')
  const rc = await post(seed)
  check('200 + status=duplicate (submission_id)', rc.status === 200 && rc.json?.status === 'duplicate', `${rc.status} ${rc.json?.status}`)
  check('no email_exists dedupe on this one', rc.json?.dedupe !== 'email_exists', `dedupe=${rc.json?.dedupe ?? 'none'}`)

  // CLEANUP + verify zero
  console.log('\n=== CLEANUP ===')
  for (const pid of parts) {
    const { data: objs } = await sb.storage.from('public-photos').list(pid)
    if (objs?.length) await sb.storage.from('public-photos').remove(objs.map((o) => `${pid}/${o.name}`))
    await sb.from('partnership_photos').delete().eq('partnership_id', pid)
    await sb.from('partnership_members').delete().eq('partnership_id', pid)
  }
  for (const uid of users) {
    await sb.from('user_survey_responses').delete().eq('user_id', uid)
    await sb.from('profiles').delete().eq('user_id', uid)
    await sb.from('partnerships').delete().eq('owner_id', uid)
    await sb.auth.admin.deleteUser(uid)
  }
  if (subs.length) await sb.from('survey_ingest_log').delete().in('submission_id', subs)

  let leftUsers = 0, page = 1
  while (true) { const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 }); leftUsers += data.users.filter((u) => u.email?.endsWith(TEST_DOMAIN) || (u.user_metadata as any)?.test_ingest === true).length; if (data.users.length < 1000) break; page++ }
  const leftLog = subs.length ? ((await sb.from('survey_ingest_log').select('submission_id', { count: 'exact', head: true }).in('submission_id', subs)).count ?? 0) : 0
  const after = (await sb.from('partnerships').select('id', { count: 'exact', head: true })).count ?? 0
  check('🧹 zero test auth users remain', leftUsers === 0, `${leftUsers}`)
  check('🧹 zero test ingest_log rows remain', leftLog === 0, `${leftLog}`)
  check('🧹 partnerships restored to baseline', before === after, `${before} -> ${after}`)

  console.log(`\n${'='.repeat(50)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(50)}`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
