/**
 * Re-notify engine. Run: npx tsx lib/renotify/__tests__/renotify.test.ts
 * Part A: audience predicate edges (pure). Part B: processAudience core with a
 * SPY sender + fake log — proves dry-run calls no provider, channel selection,
 * cap, and idempotency, with no DB.
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true } as any)

import { resolveVariant, isNeverLoggedIn, isEligible, isNotifiedOncePrior, type AudienceEntry } from '../audience'
import { processAudience, MAX_RENOTIFY_SENDS, type Sender, type RenotifyLogRow } from '../runReNotify'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── Part A: audience predicate ───────────────────────────────────────────────
eq(resolveVariant('+15125551234'), 'has_phone', 'valid phone → has_phone')
eq(resolveVariant(null), 'no_phone', 'null phone → no_phone')
eq(resolveVariant('123'), 'no_phone', 'too-short phone → no_phone')
eq(resolveVariant('   '), 'no_phone', 'blank phone → no_phone')

ok(isNeverLoggedIn(['a', 'b'], new Set()), 'couple, nobody logged in → never-logged-in')
ok(!isNeverLoggedIn(['a', 'b'], new Set(['b'])), 'couple where B logged in → EXCLUDED')
ok(!isNeverLoggedIn(['a'], new Set(['a'])), 'solo who logged in (e.g. Sunday) → EXCLUDED')
ok(!isNeverLoggedIn([], new Set()), 'no members → not eligible')

ok(isEligible({ released: true, notifiedOnce: true, liveMarket: true, neverLoggedIn: true }), 'all true → eligible')
ok(!isEligible({ released: false, notifiedOnce: true, liveMarket: true, neverLoggedIn: true }), 'not released → excluded')
ok(!isEligible({ released: true, notifiedOnce: false, liveMarket: true, neverLoggedIn: true }), 'never-notified → excluded (existing flow owns it)')
ok(!isEligible({ released: true, notifiedOnce: true, liveMarket: false, neverLoggedIn: true }), 'non-live market → excluded')
ok(!isEligible({ released: true, notifiedOnce: true, liveMarket: true, neverLoggedIn: false }), 'someone logged in → excluded')

// ── notified-once PRIOR-DAY floor (the same-Monday double-tap fix) ────────────
// Run day = 2026-07-27; its UTC midnight is the floor.
const DAY_START = '2026-07-27T00:00:00.000Z'
ok(isNotifiedOncePrior('2026-07-20T14:00:00.000Z', DAY_START), 'prior Monday notify → notified-once (re-notify target)')
ok(!isNotifiedOncePrior('2026-07-27T14:00:05.000Z', DAY_START), 'SAME-day 14:00 notify → NOT notified-once (no same-day re-hit)')
ok(!isNotifiedOncePrior('2026-07-27T00:00:00.000Z', DAY_START), 'exactly run-day midnight → excluded (strict <)')
ok(!isNotifiedOncePrior(null, DAY_START), 'never notified → not notified-once')

// End-to-end audience decision over two synthetic partnerships (same logic
// buildAudience applies): a same-day-notified never-logger is ABSENT while a
// prior-week non-engager REMAINS. Both released, live-market, never-logged-in.
{
  const priorWeek = isEligible({ released: true, liveMarket: true, neverLoggedIn: true,
    notifiedOnce: isNotifiedOncePrior('2026-07-20T14:00:00.000Z', DAY_START) })
  const sameDay = isEligible({ released: true, liveMarket: true, neverLoggedIn: true,
    notifiedOnce: isNotifiedOncePrior('2026-07-27T14:00:00.000Z', DAY_START) })
  ok(priorWeek, 'prior-week non-engager → IN re-notify audience')
  ok(!sameDay, 'same-day-notified never-logger → ABSENT from re-notify audience')
}

// ── Part B: processAudience core ─────────────────────────────────────────────
function spySender(opts?: { emailOk?: boolean; smsOk?: boolean; url?: string | null }): Sender & {
  calls: { sms: number; email: number; links: number }
} {
  const calls = { sms: 0, email: 0, links: 0 }
  return {
    calls,
    sendSMS: async () => { calls.sms++; return { success: opts?.smsOk ?? true } },
    sendEmail: async () => { calls.email++; return { success: opts?.emailOk ?? true } },
    buildSignInUrl: async () => { calls.links++; return opts?.url === undefined ? 'https://h/auth/confirm?token_hash=t&type=magiclink' : opts.url },
  }
}
const emailEntry: AudienceEntry = { partnershipId: 'p1', variant: 'no_phone', phone: null, memberEmails: ['a@b.com'] }
const phoneEntry: AudienceEntry = { partnershipId: 'p2', variant: 'has_phone', phone: '+15125551234', memberEmails: ['c@d.com'] }
const RUN = '2026-07-27'
function collector() { const rows: RenotifyLogRow[] = []; return { rows, log: async (r: RenotifyLogRow) => { rows.push(r) } } }
const base = { runDate: RUN, priorSendCount: new Map<string, number>(), alreadySent: new Set<string>() }

async function main() {
// B1 — DRY-RUN calls NO provider (the critical guardrail)
{
  const spy = spySender(); const c = collector()
  const r = await processAudience({ ...base, audience: [emailEntry, phoneEntry], sender: spy, dryRun: true, log: c.log })
  eq(spy.calls.sms + spy.calls.email + spy.calls.links, 0, 'dry-run: ZERO provider calls')
  eq(r.dryRun, true, 'dry-run flagged')
  eq(r.eligible, 2, 'dry-run: both eligible')
  eq(r.sent.sms + r.sent.email, 0, 'dry-run: nothing counted as sent')
  eq(c.rows.every((x) => x.dry_run === true), true, 'dry-run: all log rows dry_run=true')
  eq(c.rows.find((x) => x.partnership_id === 'p1')?.email_status, 'planned', 'dry-run: email planned')
  eq(c.rows.find((x) => x.partnership_id === 'p2')?.sms_status, 'planned', 'dry-run: sms planned')
}

// B2 — LIVE no_phone → email only
{
  const spy = spySender(); const c = collector()
  const r = await processAudience({ ...base, audience: [emailEntry], sender: spy, dryRun: false, log: c.log })
  eq(spy.calls.email, 1, 'no_phone: one email sent')
  eq(spy.calls.sms, 0, 'no_phone: no SMS')
  eq(r.sent.email, 1, 'no_phone: email counted')
  eq(c.rows[0].channels_attempted, ['email'], 'no_phone: channels = [email]')
  eq(c.rows[0].email_status, 'sent', 'no_phone: email sent')
}

// B3 — LIVE has_phone → SMS + email
{
  const spy = spySender(); const c = collector()
  const r = await processAudience({ ...base, audience: [phoneEntry], sender: spy, dryRun: false, log: c.log })
  eq(spy.calls.sms, 1, 'has_phone: one SMS')
  eq(spy.calls.email, 1, 'has_phone: one email')
  eq(r.sent.sms, 1, 'has_phone: sms counted')
  eq(r.sent.email, 1, 'has_phone: email counted')
  eq(c.rows[0].channels_attempted.sort(), ['email', 'sms'], 'has_phone: both channels')
}

// B4 — CAP boundary: 7 sends → send; 8 → suppressed
{
  const spy = spySender(); const c = collector()
  const r = await processAudience({
    ...base, audience: [emailEntry], sender: spy, dryRun: false,
    priorSendCount: new Map([['p1', MAX_RENOTIFY_SENDS - 1]]), log: c.log,
  })
  eq(spy.calls.email, 1, `cap: ${MAX_RENOTIFY_SENDS - 1} prior sends still sends`)
  eq(c.rows[0].suppressed_reason, null, 'cap: below cap not suppressed')
}
{
  const spy = spySender(); const c = collector()
  const r = await processAudience({
    ...base, audience: [emailEntry], sender: spy, dryRun: false,
    priorSendCount: new Map([['p1', MAX_RENOTIFY_SENDS]]), log: c.log,
  })
  eq(spy.calls.email, 0, 'cap: at cap → NO send')
  eq(r.suppressed.cap_reached, 1, 'cap: counted as cap_reached')
  eq(c.rows[0].suppressed_reason, 'cap_reached', 'cap: logged with reason')
}

// B5 — IDEMPOTENCY: already sent this run_date → skipped entirely
{
  const spy = spySender(); const c = collector()
  const r = await processAudience({
    ...base, audience: [emailEntry], sender: spy, dryRun: false,
    alreadySent: new Set(['p1']), log: c.log,
  })
  eq(spy.calls.email, 0, 'idempotent: no re-send')
  eq(c.rows.length, 0, 'idempotent: no new log row')
  eq(r.rows.length, 0, 'idempotent: skipped')
}

// B6 — send failure → failed status + failures count
{
  const spy = spySender({ emailOk: false }); const c = collector()
  const r = await processAudience({ ...base, audience: [emailEntry], sender: spy, dryRun: false, log: c.log })
  eq(c.rows[0].email_status, 'failed', 'failure: email_status failed')
  eq(r.failures, 1, 'failure: counted')
  eq(r.sent.email, 0, 'failure: not counted as sent')
}
}

main().then(() => report('renotify')).catch((e) => { console.error(e); process.exit(1) })
