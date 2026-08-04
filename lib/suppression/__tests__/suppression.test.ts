/**
 * Email suppression. Run: npx tsx lib/suppression/__tests__/suppression.test.ts
 * Pure scope logic + Svix verify + unsub token + DB escalation/scope-block (mock client).
 */
import {
  scopeForReason, escalateScope, scopeBlocks, sendScopeForNotificationType,
} from '../scope'
import { verifySvixSignature, verifySvixSignatureDetailed, signSvix, DEFAULT_SVIX_TOLERANCE_SEC } from '../svix'
import { makeUnsubToken, verifyUnsubToken } from '../unsubToken'
import { recordSuppression, isEmailSuppressed, getRenotifySuppressedEmails } from '../emailSuppressions'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── Part A: scope logic ──────────────────────────────────────────────────────
eq(scopeForReason('hard_bounce'), 'renotify', 'hard_bounce → renotify scope')
eq(scopeForReason('unsubscribe'), 'renotify', 'unsubscribe → renotify scope')
eq(scopeForReason('complaint'), 'all_noncritical', 'complaint → all_noncritical scope')

eq(escalateScope('renotify', 'all_noncritical'), 'all_noncritical', 'unsub then complaint → escalate')
eq(escalateScope('all_noncritical', 'renotify'), 'all_noncritical', 'complaint then unsub → stays strong')
eq(escalateScope('renotify', 'renotify'), 'renotify', 'renotify + renotify → renotify')

// THE HARD RULE: critical is never blocked, by any suppression.
ok(!scopeBlocks('all_noncritical', 'critical'), 'critical send NEVER blocked (complaint row)')
ok(!scopeBlocks('renotify', 'critical'), 'critical send NEVER blocked (renotify row)')
// renotify send blocked by ANY suppression.
ok(scopeBlocks('renotify', 'renotify'), 'renotify send blocked by renotify row')
ok(scopeBlocks('all_noncritical', 'renotify'), 'renotify send blocked by complaint row')
// all_noncritical send blocked ONLY by complaint.
ok(scopeBlocks('all_noncritical', 'all_noncritical'), 'all_noncritical send blocked by complaint')
ok(!scopeBlocks('renotify', 'all_noncritical'), 'all_noncritical send NOT blocked by a bounce/unsub row')

eq(sendScopeForNotificationType('match'), 'critical', 'match → critical')
eq(sendScopeForNotificationType('message'), 'critical', 'message → critical')
eq(sendScopeForNotificationType('connection_interest'), 'all_noncritical', 'connection_interest → all_noncritical')

// ── Part B: Svix signature verify ────────────────────────────────────────────
const SECRET = 'whsec_' + Buffer.from('super-secret-key-1234567890').toString('base64')
const body = JSON.stringify({ type: 'email.bounced', data: { to: ['x@y.com'] } })
const id = 'msg_123'
const now = 1_700_000_000
const tsNow = String(now)
const goodSig = signSvix(SECRET, id, tsNow, body)
ok(verifySvixSignature({ secret: SECRET, headers: { svixId: id, svixTimestamp: tsNow, svixSignature: goodSig }, rawBody: body, nowSec: now }),
  'valid signature → verified')
ok(!verifySvixSignature({ secret: SECRET, headers: { svixId: id, svixTimestamp: tsNow, svixSignature: 'v1,deadbeef' }, rawBody: body, nowSec: now }),
  'bad signature → rejected')
ok(!verifySvixSignature({ secret: SECRET, headers: { svixId: id, svixTimestamp: tsNow, svixSignature: goodSig }, rawBody: body + 'x', nowSec: now }),
  'tampered body → rejected')
// Tolerance is now 24h (bounded). A retry within 24h with a VALID sig passes;
// only truly stale (>24h) rejects — so Svix's late retries aren't dropped.
const t2h = String(now - 7200)
ok(verifySvixSignature({ secret: SECRET, headers: { svixId: id, svixTimestamp: t2h, svixSignature: signSvix(SECRET, id, t2h, body) }, rawBody: body, nowSec: now }),
  '2h-old retry with valid sig → ACCEPTED (24h tolerance lets late retries through)')
const tStale = String(now - (DEFAULT_SVIX_TOLERANCE_SEC + 3600)) // 25h
ok(!verifySvixSignature({ secret: SECRET, headers: { svixId: id, svixTimestamp: tStale, svixSignature: signSvix(SECRET, id, tStale, body) }, rawBody: body, nowSec: now }),
  '25h-old timestamp → rejected (bounded, not unbounded)')
ok(!verifySvixSignature({ secret: '', headers: { svixId: id, svixTimestamp: tsNow, svixSignature: goodSig }, rawBody: body, nowSec: now }),
  'no secret (unregistered) → rejected (fails closed)')
ok(!verifySvixSignature({ secret: SECRET, headers: { svixId: null, svixTimestamp: tsNow, svixSignature: goodSig }, rawBody: body, nowSec: now }),
  'missing svix-id header → rejected')

// ── DETAILED reason codes (the instrumentation that settles the 401 question) ──
eq(verifySvixSignatureDetailed({ secret: SECRET, headers: { svixId: id, svixTimestamp: tsNow, svixSignature: goodSig }, rawBody: body, nowSec: now }).reason, 'ok', 'valid → reason ok')
eq(verifySvixSignatureDetailed({ secret: SECRET, headers: { svixId: id, svixTimestamp: tsNow, svixSignature: 'v1,deadbeef' }, rawBody: body, nowSec: now }).reason, 'signature_mismatch', 'wrong sig, fresh ts → signature_mismatch (points at the secret)')
{
  const r = verifySvixSignatureDetailed({ secret: SECRET, headers: { svixId: id, svixTimestamp: tStale, svixSignature: signSvix(SECRET, id, tStale, body) }, rawBody: body, nowSec: now })
  eq(r.reason, 'timestamp_stale', '25h-old valid sig → timestamp_stale (points at tolerance/retry, NOT the secret)')
  ok((r.staleSec ?? 0) > DEFAULT_SVIX_TOLERANCE_SEC, 'staleSec surfaced on stale reject')
}
eq(verifySvixSignatureDetailed({ secret: '', headers: { svixId: id, svixTimestamp: tsNow, svixSignature: goodSig }, rawBody: body, nowSec: now }).reason, 'missing', 'no secret → reason missing')

// ── Part C: unsubscribe token ────────────────────────────────────────────────
const USECRET = 'unsub-secret-xyz'
{
  const tok = makeUnsubToken('Alice@Example.com', USECRET)
  eq(verifyUnsubToken(tok, USECRET)?.email, 'alice@example.com', 'valid token round-trips (lowercased)')
  ok(!verifyUnsubToken(tok, 'wrong-secret'), 'wrong secret → rejected')
  ok(!verifyUnsubToken(tok + 'x', USECRET), 'tampered signature → rejected')
  ok(!verifyUnsubToken('garbage', USECRET), 'malformed token → rejected')
  // Forgery: attacker knows a victim email but not the secret → cannot mint a token.
  const forged = Buffer.from('victim@x.com').toString('base64url') + '.' + Buffer.from('guess').toString('base64url')
  ok(!verifyUnsubToken(forged, USECRET), 'forged token (no secret) → rejected')
}

// ── Part D: DB escalation + scope-block (in-memory mock client) ──────────────
function mockAdmin() {
  const store = new Map<string, any>() // email → row
  const q = (table: string) => {
    let filterEmail: string | null = null
    const builder: any = {
      select() { return builder },
      eq(_col: string, val: string) { filterEmail = val; return builder },
      range(from: number, to: number) {
        const all = [...store.values()]
        return Promise.resolve({ data: all.slice(from, to + 1), error: null })
      },
      maybeSingle() { return Promise.resolve({ data: filterEmail ? store.get(filterEmail) ?? null : null, error: null }) },
      upsert(row: any) { store.set(row.email, { ...store.get(row.email), ...row }); return Promise.resolve({ error: null }) },
    }
    return builder
  }
  return { from: (t: string) => q(t), _store: store } as any
}

async function main() {
  const admin = mockAdmin()

  // hard bounce → renotify
  await recordSuppression(admin, { email: 'A@B.com', reason: 'hard_bounce', source: 'resend_webhook' })
  eq(admin._store.get('a@b.com')?.scope, 'renotify', 'bounce stored as renotify (lowercased)')
  ok(await isEmailSuppressed(admin, 'a@b.com', 'renotify'), 'renotify send blocked after bounce')
  ok(!await isEmailSuppressed(admin, 'a@b.com', 'all_noncritical'), 'connection_interest NOT blocked by a bounce')
  ok(!await isEmailSuppressed(admin, 'a@b.com', 'critical'), 'match NEVER blocked (critical bypass)')

  // escalate: same address complains → all_noncritical
  const esc = await recordSuppression(admin, { email: 'a@b.com', reason: 'complaint', source: 'resend_webhook' })
  ok(esc.escalated, 'complaint escalated the bounce row')
  eq(admin._store.get('a@b.com')?.scope, 'all_noncritical', 'escalated to all_noncritical')
  eq(admin._store.get('a@b.com')?.reason, 'complaint', 'reason updated to the stronger event')
  ok(await isEmailSuppressed(admin, 'a@b.com', 'all_noncritical'), 'connection_interest now blocked (complaint)')
  ok(!await isEmailSuppressed(admin, 'a@b.com', 'critical'), 'match STILL never blocked after complaint')

  // de-escalation guard: a later unsubscribe does NOT weaken the complaint
  const de = await recordSuppression(admin, { email: 'a@b.com', reason: 'unsubscribe', source: 'unsub_link' })
  ok(!de.escalated, 'weaker unsub does not escalate')
  eq(admin._store.get('a@b.com')?.scope, 'all_noncritical', 'complaint scope preserved (no de-escalation)')

  // getRenotifySuppressedEmails collects all
  await recordSuppression(admin, { email: 'c@d.com', reason: 'unsubscribe', source: 'unsub_link' })
  const set = await getRenotifySuppressedEmails(admin)
  ok(set.has('a@b.com') && set.has('c@d.com'), 'renotify-suppressed set includes both addresses')
  eq(set.size, 2, 'exactly two suppressed addresses')

  // idempotent redelivery: same bounce twice → one row
  const before = admin._store.size
  await recordSuppression(admin, { email: 'c@d.com', reason: 'unsubscribe', source: 'unsub_link' })
  eq(admin._store.size, before, 'redelivery is idempotent (no new row)')

  report('suppression')
}

main().catch((e) => { console.error(e); process.exit(1) })
