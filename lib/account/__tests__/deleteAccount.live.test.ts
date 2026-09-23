/**
 * LIVE regression test: the full deletion pipeline through the REAL action path
 * against the REAL database (real triggers, real grants, real RPC).
 *
 *   ACCOUNT_DELETION_LIVE=1 npx tsx lib/account/__tests__/deleteAccount.live.test.ts
 *
 * Without the env flag it skips (exit 0), so the normal suite loop never writes
 * to a database. It exists because the unit suite's fake store could not see
 * the bug that shipped in #54: the pre-existing partnership_photos DELETE
 * triggers failing under the function's empty search_path (42P01). Only a real
 * database with a real photo row exercises that.
 *
 * What it does, with throwaway members tagged user_metadata.qa_test =
 * 'deletion-live-test' (.invalid emails, no phone, notifications marked
 * invalid, the matcher is never run — no real member is ever involved):
 *   1. removes leftovers of any earlier run, through the same pipeline
 *   2. seeds X and Y: survey (with free text), a photo row + storage file,
 *      a released match both ways, an accepted connection, messages, a
 *      pending handoff link for X
 *   3. signs X in with a real password session and runs runDeleteMyAccount
 *      exactly as the server action does (session id from getUser; the
 *      service-role store)
 *   4. asserts the contract, then deletes Y the same way
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })

import { createHash, randomBytes } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runDeleteMyAccount, deleteMemberAccount, supabaseDeletionStore, PHOTO_BUCKETS } from '../deleteAccount'
import { classifyHandoff, hashHandoffToken, hashEmail, newHandoffToken } from '../../auth/handoff'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const TAG = 'deletion-live-test'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgaGD4DwAChAGAj5EOSQAAAABJRU5ErkJggg==', 'base64')

type Member = { userId: string; email: string; password: string; pid: string; name: string }

/** Key-order-independent JSON (jsonb and Promise.all both reorder keys). */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
}

function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return c
}

/** Exactly what lib/actions/account.ts does, minus Next's cookie store. */
function deleteAs(client: SupabaseClient, admin: SupabaseClient) {
  return runDeleteMyAccount({
    sessionUserId: async () => (await client.auth.getUser()).data.user?.id ?? null,
    store: supabaseDeletionStore(admin),
    signOut: async () => { await client.auth.signOut({ scope: 'local' }) },
  })
}

async function seed(admin: SupabaseClient, label: 'X' | 'Y', i: number): Promise<Member> {
  const email = `live-${label.toLowerCase()}-${randomBytes(4).toString('hex')}@qa.haevn.invalid`
  const password = `Qa-${randomBytes(9).toString('base64url')}`
  const name = `Lee TEST-${label}-${randomBytes(2).toString('hex')}`
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, qa_test: TAG } })
  if (u.error) throw new Error(`createUser: ${u.error.message}`)
  const userId = u.data.user.id
  const now = new Date().toISOString()
  must(await admin.from('profiles').upsert({ user_id: userId, email, full_name: name, city: 'Austin', survey_complete: true, msa_status: 'live' }, { onConflict: 'user_id' }), 'profiles')
  const p = must(await admin.from('partnerships').insert({
    owner_id: userId, profile_type: 'solo', profile_state: 'live', membership_tier: 'free', city: 'Austin',
    display_name: name, phone: null, notify_phone_invalid_at: now, notify_email_invalid_at: now,
    latitude: 30.2672 + i * 0.0001, longitude: -97.7431,
  }).select('id').single(), 'partnerships') as { id: string }
  must(await admin.from('partnership_members').insert({ partnership_id: p.id, user_id: userId, role: 'owner', survey_reviewed: true, survey_reviewed_at: now }), 'members')
  must(await admin.from('user_survey_responses').upsert({
    user_id: userId, partnership_id: p.id, completion_pct: 100, current_step: 0,
    answers_json: { q1_age: '1990-05-15', q2_gender_identity: 'nb', q20_discretion: 3, q32_looking_for: `I am ${name}, write ${email}` },
  }, { onConflict: 'user_id' }), 'survey')
  // The photo row is what fires the partnership_photos DELETE triggers (the #54 bug).
  const path = `${p.id}/live.png`
  const up = await admin.storage.from('public-photos').upload(path, PNG, { contentType: 'image/png', upsert: true })
  if (up.error) throw new Error(`upload: ${up.error.message}`)
  must(await admin.from('partnership_photos').insert({
    partnership_id: p.id, photo_url: admin.storage.from('public-photos').getPublicUrl(path).data.publicUrl,
    photo_type: 'public', order_index: 0, is_primary: true, is_banner: true,
  }), 'photos')
  return { userId, email, password, pid: p.id, name }
}

async function cleanupLeftovers(admin: SupabaseClient) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data?.users ?? []) {
    if (u.user_metadata?.qa_test !== TAG) continue
    const out = await deleteMemberAccount(supabaseDeletionStore(admin), u.id)
    console.log(`  leftover ${u.email}: ${out.status}`)
  }
}

async function main() {
  if (process.env.ACCOUNT_DELETION_LIVE !== '1') {
    console.log('↷ deleteAccount.live: skipped (set ACCOUNT_DELETION_LIVE=1 to run against the real database)')
    return
  }
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  await cleanupLeftovers(admin)

  const X = await seed(admin, 'X', 0)
  const Y = await seed(admin, 'Y', 1)
  const nowIso = new Date().toISOString()
  const row = (a: string, b: string) => ({ partnership_a: a, partnership_b: b, score: 90, tier: 'Gold', breakdown: {}, computed_at: nowIso,
    engine_version: '5cat-v6', release_at: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 86_400_000).toISOString() })
  must(await admin.from('computed_matches').insert([row(X.pid, Y.pid), row(Y.pid, X.pid)]), 'matches')
  const [lo, hi] = X.pid < Y.pid ? [X.pid, Y.pid] : [Y.pid, X.pid]
  const hs = must(await admin.from('handshakes').insert({ a_partnership: lo, b_partnership: hi, a_consent: true, b_consent: true, state: 'matched', match_score: 90, triggered_at: nowIso, matched_at: nowIso }).select('id').single(), 'handshake') as { id: string }
  must(await admin.from('messages').insert([
    { handshake_id: hs.id, sender_partnership: X.pid, content: `hi from ${X.name}` },
    { handshake_id: hs.id, sender_partnership: Y.pid, content: 'hello' },
  ]), 'messages')
  const token = newHandoffToken()
  must(await admin.from('login_links').insert({ token_hash: hashHandoffToken(token), email_hash: hashEmail(X.email), user_id: X.userId, sent: false, expires_at: new Date(Date.now() + 900_000).toISOString() }), 'login_links')

  const anonBefore = (await admin.from('anonymized_survey_responses').select('*', { count: 'exact', head: true })).count ?? 0

  // ── The real action path ──
  const xClient = await signedIn(X.email, X.password)
  const res = await deleteAs(xClient, admin)
  eq(res, { ok: true }, 'X deletes through the real action path (real session, real RPC, real triggers)')

  // ── Contract ──
  const gone = await admin.auth.admin.getUserById(X.userId)
  ok(!gone.data?.user, 'auth user gone')
  const pw = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.signInWithPassword({ email: X.email, password: X.password })
  ok(!!pw.error, 'password sign-in refused')
  const otp = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.signInWithOtp({ email: X.email, options: { shouldCreateUser: false } })
  ok(!!otp.error, 'magic-link sign-in refused (no account to send to)')
  const link = await admin.from('login_links').select('expires_at, consumed_at').eq('token_hash', hashHandoffToken(token)).maybeSingle()
  eq(classifyHandoff(link.data ?? null, Date.now()), 'invalid', 'pending handoff link is "not valid"')

  const counts: Record<string, number> = {}
  const count = async (label: string, q: PromiseLike<{ count: number | null }>) => { counts[label] = (await q).count ?? 0 }
  await Promise.all([
    count('profiles', admin.from('profiles').select('*', { count: 'exact', head: true }).eq('user_id', X.userId)),
    count('partnerships', admin.from('partnerships').select('*', { count: 'exact', head: true }).eq('id', X.pid)),
    count('members', admin.from('partnership_members').select('*', { count: 'exact', head: true }).eq('user_id', X.userId)),
    count('survey', admin.from('user_survey_responses').select('*', { count: 'exact', head: true }).eq('user_id', X.userId)),
    count('photos', admin.from('partnership_photos').select('*', { count: 'exact', head: true }).eq('partnership_id', X.pid)),
    count('login_links', admin.from('login_links').select('*', { count: 'exact', head: true }).eq('user_id', X.userId)),
    count('matches', admin.from('computed_matches').select('*', { count: 'exact', head: true }).or(`partnership_a.eq.${X.pid},partnership_b.eq.${X.pid}`)),
    count('handshakes', admin.from('handshakes').select('*', { count: 'exact', head: true }).eq('id', hs.id)),
    count('messages', admin.from('messages').select('*', { count: 'exact', head: true }).eq('handshake_id', hs.id)),
  ])
  eq(canon(counts), canon({ profiles: 0, partnerships: 0, members: 0, survey: 0, photos: 0, login_links: 0, matches: 0, handshakes: 0, messages: 0 }), 'zero PII / relationship rows remain for X')
  let files = 0
  for (const b of PHOTO_BUCKETS) files += ((await admin.storage.from(b).list(X.pid)).data ?? []).length
  eq(files, 0, 'X storage files removed')

  const anonAfter = (await admin.from('anonymized_survey_responses').select('*', { count: 'exact', head: true })).count ?? 0
  eq(anonAfter - anonBefore, 1, 'one anonymized survey row written')
  const latest = must(await admin.from('anonymized_survey_responses').select('*').order('id').limit(1000), 'anon rows') as Array<Record<string, unknown>>
  const mine = latest.find((r) => canon(r.answers) === canon({ age_band: '35-39', q2_gender_identity: 'nb', q20_discretion: 3 }))
  ok(!!mine && mine.city === 'Austin', 'anonymized answers present, city kept, free text + birthdate gone')
  ok(!!mine && !JSON.stringify(mine).includes(X.email) && !JSON.stringify(mine).includes(X.name), 'no name/email in the anonymized row')
  const hash = createHash('sha256').update(X.pid).digest('hex')
  const audit = must(await admin.from('account_deletions').select('city').eq('partnership_hash', hash), 'audit') as Array<{ city: string }>
  eq(audit, [{ city: 'Austin' }], 'account_deletions audit row written (city + hash only)')

  const again = await deleteMemberAccount(supabaseDeletionStore(admin), X.userId)
  eq(again, { status: 'already_deleted' }, 'second attempt is idempotent')
  const yRows = (await admin.from('computed_matches').select('*', { count: 'exact', head: true }).or(`partnership_a.eq.${Y.pid},partnership_b.eq.${Y.pid}`)).count
  eq(yRows, 0, 'counterpart Y has no match row left pointing at X')

  // ── Members cannot reach the new objects ──
  const yClient = await signedIn(Y.email, Y.password)
  const direct = await yClient.rpc('delete_member_account', { p_user_id: Y.userId, p_anonymized: null, p_survey_updated_at: null })
  ok(!!direct.error, 'a signed-in member cannot call delete_member_account directly')
  const peek = await yClient.from('anonymized_survey_responses').select('*').limit(1)
  ok(!!peek.error || (peek.data ?? []).length === 0, 'a signed-in member cannot read anonymized answers')

  // ── Clean up Y the same way ──
  eq(await deleteAs(yClient, admin), { ok: true }, 'Y deleted through the same path (cleanup)')

  report('deleteAccount.live')
}

main().catch((e) => { console.error(e); process.exit(1) })
