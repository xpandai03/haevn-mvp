/**
 * Account-deletion pipeline on fixtures. Run: npx tsx lib/account/__tests__/deleteAccount.test.ts
 *
 * The fake store models the database the way migration 059 treats it (anonymize
 * first, then delete, all-or-nothing) so the orchestration can be exercised end
 * to end; the SQL itself is pinned by static checks at the bottom and proven
 * against the real database in the live proof (scripts/account-deletion-live-proof.ts).
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  deleteMemberAccount,
  runDeleteMyAccount,
  type AnonymizedPayload,
  type DeletionStore,
  type SurveyRow,
} from '../deleteAccount'
import { classifyHandoff, hashHandoffToken } from '../../auth/handoff'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const ROOT = join(__dirname, '../../..')
const NOW = new Date('2026-09-22T12:00:00Z')
const FUTURE = '2026-09-29T12:00:00Z'

// ── Fake database ────────────────────────────────────────────────────────────

interface World {
  users: Map<string, { email: string; password: string; phone: string }>
  oneTimeTokens: Array<{ user_id: string; token: string }>
  loginLinks: Array<{ token_hash: string; user_id: string; expires_at: string; consumed_at: string | null }>
  profiles: Array<{ user_id: string; full_name: string; email: string }>
  partnerships: Map<string, { owner_id: string; city: string; display_name: string; phone: string; membership_tier: string }>
  members: Array<{ partnership_id: string; user_id: string }>
  surveys: Map<string, SurveyRow & { partnership_id: string }>
  handshakes: Array<{ id: string; a: string; b: string }>
  messages: Array<{ handshake_id: string; sender: string; content: string }>
  matches: Array<{ a: string; b: string }>
  systemEvents: Array<{ partnership_id: string | null; metadata: Record<string, unknown> }>
  anonymized: Array<{ city: string; answers: Record<string, unknown>; completion_pct: number | null }>
  deletions: Array<{ city: string; partnership_hash: string }>
  storage: Map<string, Set<string>>
  log: string[]
}

const A = { user: 'user-a', pid: 'pid-a', email: 'alex.rivera@example.com', name: 'Alex Rivera', phone: '+15125550101' }
const B = { user: 'user-b', pid: 'pid-b', email: 'blake.chen@example.com', name: 'Blake Chen', phone: '+15125550102' }
const HS = 'hs-ab'
const A_TOKEN = 'raw-handoff-token-a'

function world(): World {
  const w: World = {
    users: new Map(),
    oneTimeTokens: [],
    loginLinks: [],
    profiles: [],
    partnerships: new Map(),
    members: [],
    surveys: new Map(),
    handshakes: [{ id: HS, a: A.pid, b: B.pid }],
    messages: [
      { handshake_id: HS, sender: A.pid, content: `hi it's ${A.name}` },
      { handshake_id: HS, sender: B.pid, content: 'hey!' },
    ],
    matches: [{ a: A.pid, b: B.pid }],
    systemEvents: [
      { partnership_id: null, metadata: { partnership_id: A.pid, email: A.email, phone: A.phone, email_sent: true } },
      { partnership_id: A.pid, metadata: { computed: 3 } },
      { partnership_id: null, metadata: { partnership_id: B.pid, email: B.email } },
    ],
    anonymized: [],
    deletions: [],
    storage: new Map([
      ['public-photos', new Set([`${A.pid}/1.jpg`, `${A.pid}/2.jpg`, `${B.pid}/1.jpg`])],
      ['private-photos', new Set([`${A.pid}/p.jpg`])],
      ['partnership-photos', new Set<string>()],
      ['chat-media', new Set([`${HS}/img.png`])],
    ]),
    log: [],
  }
  for (const m of [A, B]) {
    w.users.set(m.user, { email: m.email, password: 'pw', phone: m.phone })
    w.oneTimeTokens.push({ user_id: m.user, token: `otp-${m.user}` })
    w.profiles.push({ user_id: m.user, full_name: m.name, email: m.email })
    w.partnerships.set(m.pid, { owner_id: m.user, city: 'Austin', display_name: m.name, phone: m.phone, membership_tier: 'plus' })
    w.members.push({ partnership_id: m.pid, user_id: m.user })
    w.surveys.set(m.user, {
      partnership_id: m.pid,
      answers_json: { q1_age: '1991-05-02', q2_gender_identity: 'man', q32_looking_for: `I'm ${m.name}, ${m.email}`, q20_discretion: 3 },
      completion_pct: 100,
      updated_at: '2026-09-01T00:00:00.000000+00:00',
    })
  }
  w.loginLinks.push({ token_hash: hashHandoffToken(A_TOKEN), user_id: A.user, expires_at: FUTURE, consumed_at: null })
  return w
}

// Sign-in paths, as the real ones decide them.
const signIn = {
  password: (w: World, email: string) => [...w.users.values()].some((u) => u.email === email && u.password === 'pw'),
  magicLink: (w: World, userId: string) => w.oneTimeTokens.some((t) => t.user_id === userId) && w.users.has(userId),
  handoff: (w: World, raw: string) =>
    classifyHandoff(w.loginLinks.find((l) => l.token_hash === hashHandoffToken(raw)) ?? null, NOW.getTime()),
}

/** Everything a counterpart could see that references `pid`. */
function visibleTo(w: World, pid: string, other: string) {
  return {
    matches: w.matches.filter((m) => [m.a, m.b].includes(pid) && [m.a, m.b].includes(other)).length,
    handshakes: w.handshakes.filter((h) => [h.a, h.b].includes(pid)).length,
    messages: w.messages.filter((m) => m.sender === pid || w.handshakes.every((h) => h.id !== m.handshake_id)).length,
  }
}

interface FakeOpts { failStorage?: boolean; changeSurveyOnce?: boolean; failRpc?: boolean }

function fakeStore(w: World, opts: FakeOpts = {}): DeletionStore {
  let surveyChanged = false
  return {
    async userExists(id) { return w.users.has(id) },
    async readSurvey(id) {
      const s = w.surveys.get(id)
      return s ? { answers_json: s.answers_json, completion_pct: s.completion_pct, updated_at: s.updated_at } : null
    },
    async partnershipIds(id) {
      const ids = new Set(w.members.filter((m) => m.user_id === id).map((m) => m.partnership_id))
      for (const [pid, p] of w.partnerships) if (p.owner_id === id) ids.add(pid)
      return [...ids]
    },
    async hasOtherMembers(pids, id) { return w.members.some((m) => pids.includes(m.partnership_id) && m.user_id !== id) },
    async handshakeIds(pids) { return w.handshakes.filter((h) => pids.includes(h.a) || pids.includes(h.b)).map((h) => h.id) },
    async listFiles(bucket, prefix) { return [...(w.storage.get(bucket) ?? [])].filter((p) => p.startsWith(prefix + '/')) },
    async removeFiles(bucket, paths) {
      if (opts.failStorage) throw new Error('storage unavailable')
      w.log.push(`storage:${bucket}`)
      for (const p of paths) w.storage.get(bucket)!.delete(p)
    },
    // Mirrors delete_member_account(): all-or-nothing, anonymize before delete.
    async runDeletion(userId, anonymized: AnonymizedPayload | null, surveyUpdatedAt) {
      w.log.push('rpc')
      const user = w.users.get(userId)
      if (!user) return { status: 'already_deleted' as const }
      if (opts.failRpc) throw new Error('boom')
      const pids = [...new Set(w.members.filter((m) => m.user_id === userId).map((m) => m.partnership_id))]
      if (w.members.some((m) => pids.includes(m.partnership_id) && m.user_id !== userId)) throw new Error('shared_partnership')
      const survey = w.surveys.get(userId)
      if (opts.changeSurveyOnce && !surveyChanged && survey) {
        surveyChanged = true
        survey.updated_at = '2026-09-22T11:59:59.000000+00:00'
      }
      if (survey && (!anonymized || surveyUpdatedAt !== survey.updated_at)) throw new Error('survey_changed')
      const city = w.partnerships.get(pids[0])?.city ?? ''
      // a. anonymize
      if (survey) { w.log.push('anonymize'); w.anonymized.push({ city, answers: anonymized!.answers, completion_pct: anonymized!.completion_pct }) }
      // b. audit
      const hash = `sha256(${pids[0]})`
      if (!w.deletions.some((d) => d.partnership_hash === hash)) w.deletions.push({ city, partnership_hash: hash })
      // c-f. delete
      w.log.push('delete')
      for (const e of w.systemEvents) {
        if (e.metadata.partnership_id && pids.includes(e.metadata.partnership_id as string) || e.metadata.email === user.email) {
          delete e.metadata.email; delete e.metadata.phone
        }
      }
      const hsIds = w.handshakes.filter((h) => pids.includes(h.a) || pids.includes(h.b)).map((h) => h.id)
      w.messages = w.messages.filter((m) => !hsIds.includes(m.handshake_id) && !pids.includes(m.sender))
      w.handshakes = w.handshakes.filter((h) => !hsIds.includes(h.id))
      w.matches = w.matches.filter((m) => !pids.includes(m.a) && !pids.includes(m.b))
      w.surveys.delete(userId)
      for (const p of pids) w.partnerships.delete(p)
      w.members = w.members.filter((m) => m.user_id !== userId)
      w.profiles = w.profiles.filter((p) => p.user_id !== userId)
      w.loginLinks = w.loginLinks.filter((l) => l.user_id !== userId)
      w.oneTimeTokens = w.oneTimeTokens.filter((t) => t.user_id !== userId)
      w.users.delete(userId)
      return { status: 'deleted' as const }
    },
  }
}

function dump(w: World): string {
  return JSON.stringify(w, (_k, v) => (v instanceof Map ? [...v.entries()] : v instanceof Set ? [...v] : v))
}

async function main() {
  // ── Happy path ───────────────────────────────────────────────────────────
  {
    const w = world()
    eq(signIn.handoff(w, A_TOKEN), 'valid', 'precondition: A\'s handoff link from last Monday is valid')
    ok(signIn.password(w, A.email) && signIn.magicLink(w, A.user), 'precondition: A can sign in by password and magic link')

    const res = await runDeleteMyAccount({
      sessionUserId: async () => A.user,
      store: fakeStore(w),
      signOut: async () => { w.log.push('signOut') },
      now: NOW,
    })
    eq(res, { ok: true }, 'deletion succeeds')

    // Survey survives, anonymized, city only.
    eq(w.anonymized.length, 1, 'one anonymized survey row')
    eq(w.anonymized[0].city, 'Austin', 'city kept')
    eq(w.anonymized[0].answers, { age_band: '35-39', q2_gender_identity: 'man', q20_discretion: 3 }, 'structured answers kept, free text + birthdate gone')

    // Zero PII left anywhere.
    const all = dump(w)
    for (const needle of [A.email, A.name, A.phone, A.user, `${A.pid}/`]) ok(!all.includes(needle), `no trace of "${needle}" remains anywhere`)
    ok(all.includes(B.email) && all.includes(B.name), 'counterpart B\'s own data is untouched')
    ok(w.storage.get('public-photos')!.has(`${B.pid}/1.jpg`), 'B\'s photos untouched')
    eq(w.storage.get('chat-media')!.size, 0, 'chat images of the A–B thread removed')
    eq(w.partnerships.has(A.pid), false, 'partnership (and its membership tier) gone')

    // Auth gone; every sign-in path refuses.
    eq(w.users.has(A.user), false, 'auth user gone')
    eq(signIn.password(w, A.email), false, 'password sign-in refused')
    eq(signIn.magicLink(w, A.user), false, 'pending magic link refused')
    eq(signIn.handoff(w, A_TOKEN), 'invalid', 'last Monday\'s handoff link is "not valid"')

    // Counterpart sees nothing of A; B can still sign in.
    eq(visibleTo(w, A.pid, B.pid), { matches: 0, handshakes: 0, messages: 0 }, 'B sees no match, connection or message from A')
    ok(signIn.password(w, B.email), 'B unaffected')

    // Audit + ordering.
    eq(w.deletions.length, 1, 'one departure audit row')
    eq(Object.keys(w.deletions[0]).sort(), ['city', 'partnership_hash'], 'audit row carries only city + hash')
    eq(w.log, ['rpc', 'anonymize', 'delete', 'storage:public-photos', 'storage:private-photos', 'storage:chat-media', 'signOut'],
      'anonymize → delete (one transaction) → storage only after commit → sign out')

    // Idempotent second attempt.
    const again = await deleteMemberAccount(fakeStore(w), A.user, NOW)
    eq(again, { status: 'already_deleted' }, 'second deletion is a no-op')
    eq(w.anonymized.length, 1, 'no duplicate anonymized row')
    eq(w.deletions.length, 1, 'no duplicate audit row')
    const retry = await runDeleteMyAccount({ sessionUserId: async () => null, store: fakeStore(w), signOut: async () => {} })
    eq(retry, { ok: true }, 'a retry after success (no session left) lands on goodbye, no error')
  }

  // ── A member cannot delete a different member ────────────────────────────
  {
    const w = world()
    // Whatever a caller sends, only the session id is used.
    const res = await (runDeleteMyAccount as (d: unknown, ...rest: unknown[]) => Promise<unknown>)(
      { sessionUserId: async () => A.user, store: fakeStore(w), signOut: async () => {}, now: NOW, userId: B.user },
      { userId: B.user }
    )
    eq(res, { ok: true }, 'call succeeds')
    ok(!w.users.has(A.user) && w.users.has(B.user), 'only the session member (A) is deleted, never the requested B')

    const action = readFileSync(join(ROOT, 'lib/actions/account.ts'), 'utf8')
    ok(/export async function deleteMyAccount\(\)/.test(action), 'the server action takes no arguments')
    ok(/auth\.getUser\(\)/.test(action), 'the id comes from getUser (auth-server verified), not getSession')
  }

  // ── Failure modes ────────────────────────────────────────────────────────
  {
    // REGRESSION (2026-09-22 QA): the transaction failed (42P01 from a photo
    // trigger) AFTER storage had been cleared, so the member kept the account
    // but lost their photo files. Fail-closed means a failed transaction
    // deletes NOTHING — files included.
    const w = world()
    const errs: string[] = []
    const orig = console.error
    console.error = (...a: unknown[]) => { errs.push(a.map(String).join(' ')) }
    const res = await runDeleteMyAccount({ sessionUserId: async () => A.user, store: fakeStore(w, { failRpc: true }), signOut: async () => {}, now: NOW })
    console.error = orig
    eq(res, { ok: false, error: 'failed' }, 'transaction failure → error shown')
    ok(w.users.has(A.user) && w.surveys.has(A.user), 'transaction failure leaves the account and answers intact')
    ok(w.storage.get('public-photos')!.has(`${A.pid}/1.jpg`) && w.storage.get('private-photos')!.has(`${A.pid}/p.jpg`) && w.storage.get('chat-media')!.has(`${HS}/img.png`),
      'transaction failure leaves every storage file in place')
    ok(!w.log.some((x) => x.startsWith('storage:')), 'no storage removal is even attempted before the transaction commits')
    ok(errs.some((e) => /\[account-delete\] failed/.test(e) && /stage=transaction/.test(e) && /boom/.test(e)),
      'the server log names the stage and carries the underlying error')
  }
  {
    // Storage failing AFTER the commit: the account is gone; the member must
    // still land on goodbye, and the leftover is logged for the sweeper.
    const w = world()
    const errs: string[] = []
    const orig = console.error
    console.error = (...a: unknown[]) => { errs.push(a.map(String).join(' ')) }
    const res = await runDeleteMyAccount({ sessionUserId: async () => A.user, store: fakeStore(w, { failStorage: true }), signOut: async () => {}, now: NOW })
    console.error = orig
    eq(res, { ok: true }, 'post-commit storage failure still completes the deletion')
    eq(w.users.has(A.user), false, 'account gone')
    ok(errs.some((e) => /storage cleanup incomplete/.test(e)), 'leftover files are logged')
  }
  {
    const w = world()
    const out = await deleteMemberAccount(fakeStore(w, { changeSurveyOnce: true }), A.user, NOW)
    eq(out.status, 'deleted', 'survey edited mid-deletion → copy rebuilt and deletion completes')
    eq(w.anonymized.length, 1, 'exactly one anonymized row after the retry')
  }
  {
    const w = world()
    w.members.push({ partnership_id: A.pid, user_id: B.user })
    const res = await runDeleteMyAccount({ sessionUserId: async () => A.user, store: fakeStore(w), signOut: async () => {}, now: NOW })
    eq(res, { ok: false, error: 'shared_partnership' }, 'shared partnership refused with its own message')
    ok(w.partnerships.has(A.pid) && w.users.has(A.user), 'nothing deleted for a shared partnership')
  }

  // ── Migration 059: the SQL keeps its promises ────────────────────────────
  {
    const sql = readFileSync(join(ROOT, 'supabase/migrations/059_account_deletion.sql'), 'utf8')
    // REGRESSION: search_path '' made the pre-existing, unqualified
    // partnership_photos DELETE triggers fail (42P01). 060 pins it.
    const fix = readFileSync(join(ROOT, 'supabase/migrations/060_account_deletion_search_path.sql'), 'utf8')
    ok(/alter function public\.delete_member_account\(uuid, jsonb, timestamptz\)\s+set search_path = public, pg_temp;/.test(fix),
      '060 pins delete_member_account search_path to public, pg_temp (pg_temp last)')
    const body = sql.slice(sql.indexOf('create or replace function public.delete_member_account'))
    const anon = body.indexOf('insert into public.anonymized_survey_responses')
    const firstDelete = body.search(/\bdelete from\b/)
    ok(anon > 0 && firstDelete > anon, 'anonymize is written before the first delete')
    ok(body.indexOf('delete from public.partnerships') < body.indexOf('delete from auth.users'), 'partnership (owner_id NO ACTION) deleted before the auth user')
    ok(body.indexOf('delete from public.user_survey_responses') < body.indexOf('delete from public.partnerships'), 'survey rows (partnership_id NO ACTION) deleted before the partnership')
    ok(body.indexOf('delete from public.messages') < body.indexOf('delete from public.partnerships'), 'messages (sender_partnership NO ACTION) deleted before the partnership')
    ok(body.indexOf('delete from public.message_reads') < body.indexOf('delete from auth.users'), 'message_reads (user_id NO ACTION) deleted before the auth user')
    ok(/revoke all on function public\.delete_member_account[^;]+from public, anon, authenticated/.test(sql), 'members cannot execute the function')
    ok(/revoke all on public\.anonymized_survey_responses from anon, authenticated/.test(sql), 'anonymized answers unreachable by member roles')
    ok(/enable row level security/.test(sql), 'RLS on the new tables')
    const anonTable = sql.slice(sql.indexOf('create table if not exists public.anonymized_survey_responses'), sql.indexOf(');', sql.indexOf('anonymized_survey_responses')))
    ok(!/user_id|partnership|email|phone|name|hash/.test(anonTable), 'anonymized table has no identifying column')
  }

  // ── UI: the regression (a Danger Zone button with no handler) ────────────
  {
    const page = readFileSync(join(ROOT, 'app/profile/page.tsx'), 'utf8')
    const section = readFileSync(join(ROOT, 'components/profile/DeleteAccountSection.tsx'), 'utf8')
    ok(!/No-op for now/.test(page) && !/function DangerRow/.test(page), 'the no-op Danger Zone rows are gone')
    ok(/<DeleteAccountSection \/>/.test(page), 'the profile (settings) page renders the delete section')
    ok(page.lastIndexOf('<DeleteAccountSection />') > page.lastIndexOf('<SignOutButton />'), 'delete section sits at the bottom, below Sign out')
    ok(/Delete my account/.test(section) && /bg-red-600/.test(section), 'clearly-marked red "Delete my account" button')
    ok(section.includes('This permanently deletes your account and personal information. Your anonymous survey responses are retained. This cannot be undone.'), 'confirmation states exactly what happens')
    ok(/onClick=\{confirm\}/.test(section) && /await deleteMyAccount\(\)/.test(section), 'the confirm button actually calls the delete action')
    ok(/window\.location\.replace\('\/goodbye'\)/.test(section), 'success lands on /goodbye')
    const mw = readFileSync(join(ROOT, 'middleware.ts'), 'utf8')
    ok(/'\/goodbye'/.test(mw), '/goodbye is public (the member has no session by then)')
  }

  report('deleteAccount')
}

main().catch((e) => { console.error(e); process.exit(1) })
