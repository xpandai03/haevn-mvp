/**
 * Impersonation invariants. Run: npx tsx lib/admin/__tests__/impersonation.test.ts
 *
 * Audit-FIRST ordering, refuse-without-generating, and the handoff-token
 * semantics that replaced the magic-link-in-the-clipboard flow after the
 * 2026-08-25 incident (token burned by an automated GET ~2s after generation).
 */
import {
  runImpersonation,
  classifyHandoff,
  hashHandoffToken,
  newHandoffToken,
  buildHandoffUrl,
  handoffUrlIsSafe,
  HANDOFF_TTL_MS,
  HANDOFF_COPY,
  type ImpersonationDeps,
} from '../impersonation'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const T0 = Date.parse('2026-08-28T12:00:00.000Z')
const TOKEN = 'a'.repeat(64)

function deps(over?: Partial<ImpersonationDeps>) {
  const calls: string[] = []
  const audits: any[] = []
  const d: ImpersonationDeps = {
    resolveEmail: async () => { calls.push('resolveEmail'); return 'target@user.com' },
    writeAudit: async (row) => { calls.push('writeAudit'); audits.push(row) },
    randomToken: () => TOKEN,
    now: () => T0,
    ...over,
  }
  return { d, calls, audits }
}

/** In-memory stand-in for the atomic conditional UPDATE in the consume route. */
function fakeStore(row: { expires_at: string; consumed_at: string | null }) {
  return {
    row,
    /** mirrors: UPDATE ... WHERE token_hash=? AND consumed_at IS NULL AND expires_at > now */
    claim(nowMs: number): boolean {
      if (this.row.consumed_at !== null) return false
      if (Date.parse(this.row.expires_at) <= nowMs) return false
      this.row.consumed_at = new Date(nowMs).toISOString()
      return true
    },
  }
}

async function main() {
  // ── generation: refuse without generating anything ──────────────────────
  {
    const { d, calls } = deps()
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: '  ' }, d)
    ok(!r.ok && r.status === 400, 'empty reason → 400')
    eq(calls, [], 'empty reason → no resolve/audit/token at all')
  }
  {
    const { d, calls } = deps()
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: '', reason: 'why' }, d)
    ok(!r.ok && r.status === 400, 'missing targetUserId → 400')
    eq(calls, [], 'missing targetUserId → nothing happens')
  }
  {
    const { d, calls } = deps({ resolveEmail: async () => null })
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'ghost', reason: 'why' }, d)
    ok(!r.ok && r.status === 404, 'unknown target → 404')
    ok(!calls.includes('writeAudit'), 'unknown target → no audit row, no token')
  }

  // ── audit-first ordering is the guarantee ───────────────────────────────
  {
    const { d, calls, audits } = deps()
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: ' trust review ' }, d)
    ok(r.ok, 'valid request succeeds')
    eq(calls, ['resolveEmail', 'writeAudit'], 'audit is written before anything is returned')
    eq(audits[0].reason, 'trust review', 'reason is trimmed into the audit row')
    eq(audits[0].admin_email, 'a@admin', 'admin identity recorded')
    eq(audits[0].expires_at, new Date(T0 + HANDOFF_TTL_MS).toISOString(), 'TTL is 15 minutes from generation')
  }
  {
    // If the audit write fails, the caller must get nothing back.
    const { d } = deps({ writeAudit: async () => { throw new Error('db down') } })
    let threw = false
    try { await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: 'why' }, d) }
    catch { threw = true }
    ok(threw, 'audit write failure propagates — no URL is returned without a log row')
  }

  // ── the hash is what is stored; the raw token is what is returned ───────
  {
    const { d, audits } = deps()
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: 'why' }, d)
    ok(r.ok, 'generated')
    const stored = audits[0].token_hash
    ok(stored !== TOKEN, 'stored token_hash is NOT the raw token')
    eq(stored, hashHandoffToken(TOKEN), 'stored value is the SHA-256 of the token')
    eq(stored.length, 64, 'token_hash is a 64-char sha256 hex digest')
    ok(!JSON.stringify(audits[0]).includes(TOKEN), 'raw token appears nowhere in the audit row')
    ok(r.ok && r.url.includes(TOKEN), 'raw token is returned to the admin exactly once, in the URL')
  }
  {
    const a = newHandoffToken(), b = newHandoffToken()
    eq(a.length, 64, 'handoff token is 256 bits of hex')
    ok(a !== b, 'handoff tokens are unique')
    ok(hashHandoffToken(a) !== a, 'hash never equals the raw token')
  }

  // ── apex-vs-www guard: a generated link must never be on the apex ───────
  {
    const { d } = deps()
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: 'why' }, d)
    ok(r.ok && handoffUrlIsSafe(r.url), 'generated handoff URL is https and on www')
    ok(!handoffUrlIsSafe(buildHandoffUrl(TOKEN, 'https://haevn.app')), 'apex host is rejected by the guard')
    ok(!handoffUrlIsSafe(buildHandoffUrl(TOKEN, 'http://www.haevn.app')), 'plain http is rejected by the guard')
  }

  // ── redemption: three distinct states, never a catch-all ────────────────
  {
    const live = { target_user_id: 'u1', expires_at: new Date(T0 + 60_000).toISOString(), consumed_at: null }
    eq(classifyHandoff(live, T0), 'valid', 'unconsumed, unexpired → valid')
    eq(classifyHandoff({ ...live, consumed_at: new Date(T0).toISOString() }, T0), 'used', 'consumed → used')
    eq(classifyHandoff({ ...live, expires_at: new Date(T0 - 1).toISOString() }, T0), 'expired', 'past expiry → expired')
    eq(classifyHandoff(null, T0), 'invalid', 'no row → invalid')
    // used wins over expired: an already-redeemed link is never called "expired"
    eq(classifyHandoff({ ...live, expires_at: new Date(T0 - 1).toISOString(), consumed_at: new Date(T0).toISOString() }, T0),
      'used', 'consumed AND expired reports "used", the more accurate story')
    const msgs = Object.values(HANDOFF_COPY).map((c) => c.title)
    eq(new Set(msgs).size, msgs.length, 'every failure state has its own distinct message')
  }

  // ── single use, enforced the way the DB enforces it ─────────────────────
  {
    const s = fakeStore({ expires_at: new Date(T0 + HANDOFF_TTL_MS).toISOString(), consumed_at: null })
    ok(s.claim(T0), 'first consume succeeds')
    ok(!s.claim(T0 + 1000), 'second consume of the same token is refused')
    eq(classifyHandoff({ target_user_id: 'u1', ...s.row }, T0 + 1000), 'used', 'and the landing page then says "used"')
  }
  {
    const s = fakeStore({ expires_at: new Date(T0 + HANDOFF_TTL_MS).toISOString(), consumed_at: null })
    const afterTtl = T0 + HANDOFF_TTL_MS + 1
    ok(!s.claim(afterTtl), 'consume after expiry is refused')
    eq(s.row.consumed_at, null, 'a refused consume does not mark the row consumed')
    eq(classifyHandoff({ target_user_id: 'u1', ...s.row }, afterTtl), 'expired', 'and the landing page says "expired"')
  }
  {
    // The whole point of the fix: reading the landing page must not consume.
    const s = fakeStore({ expires_at: new Date(T0 + HANDOFF_TTL_MS).toISOString(), consumed_at: null })
    for (let i = 0; i < 5; i++) classifyHandoff({ target_user_id: 'u1', ...s.row }, T0 + i)
    eq(s.row.consumed_at, null, 'GET-side classification never sets consumed_at (scanner-safe)')
    ok(s.claim(T0 + 10), 'the human POST still works after 5 machine GETs')
  }

  report('impersonation')
}
main()
