/**
 * Magic-link sign-in invariants. Run: npx tsx lib/auth/__tests__/loginLink.test.ts
 *
 * The three things that must never regress: no enumeration, no account
 * creation, and nothing redeemable in the email itself.
 */
import {
  requestLoginLink, checkRate, looksLikeEmail, loginLinkUrl, loginLinkUrlIsSafe,
  LOGIN_LINK_TTL_MS, LOGIN_LINK_TTL_MINUTES, RATE_LIMIT,
  type LoginLinkDeps, type LoginLinkRow,
} from '../loginLink'
import { hashEmail, hashHandoffToken, normalizeEmail, classifyHandoff } from '../handoff'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const T0 = Date.parse('2026-08-28T12:00:00.000Z')
const TOKEN = 'b'.repeat(64)

function deps(over?: Partial<LoginLinkDeps>) {
  const rows: LoginLinkRow[] = []
  const sends: { to: string; url: string }[] = []
  const d: LoginLinkDeps = {
    findUserByEmail: async (e) => (e === 'member@haevn.co' ? 'user-1' : null),
    countAttempts: async () => ({ email: 0, ip: 0 }),
    record: async (r) => { rows.push(r) },
    sendLink: async (to, url) => { sends.push({ to, url }) },
    randomToken: () => TOKEN,
    now: () => T0,
    ...over,
  }
  return { d, rows, sends }
}

async function main() {
  // ── no enumeration: every outcome writes exactly one row ──
  {
    const known = deps()
    eq(await requestLoginLink('member@haevn.co', '1.2.3.4', known.d), 'sent', 'known email → sent')
    eq(known.rows.length, 1, 'known email writes exactly one row')
    eq(known.sends.length, 1, 'known email sends exactly one email')

    const unknown = deps()
    eq(await requestLoginLink('nobody@haevn.co', '1.2.3.4', unknown.d), 'no_account', 'unknown email → no_account')
    eq(unknown.rows.length, 1, 'unknown email ALSO writes exactly one row')
    eq(unknown.sends.length, 0, 'unknown email sends NOTHING')
    eq(unknown.rows[0].token_hash, null, 'unknown email stores no token')
    eq(unknown.rows[0].user_id, null, 'unknown email stores no user')
    eq(unknown.rows[0].sent, false, 'unknown email row is marked not-sent')

    const limited = deps({ countAttempts: async () => ({ email: RATE_LIMIT.perEmail.max, ip: 0 }) })
    eq(await requestLoginLink('member@haevn.co', '1.2.3.4', limited.d), 'rate_limited', 'over limit → rate_limited')
    eq(limited.rows.length, 1, 'rate-limited request ALSO writes exactly one row')
    eq(limited.sends.length, 0, 'rate-limited request sends nothing')

    // The shape a caller could observe is identical across all three.
    const shape = (r: LoginLinkRow) => Object.keys(r).sort().join(',')
    eq(shape(known.rows[0]), shape(unknown.rows[0]), 'known and unknown rows have the identical shape')
    eq(shape(known.rows[0]), shape(limited.rows[0]), 'rate-limited row has the identical shape too')
  }

  // ── never creates an account: lookup happens BEFORE any token exists ──
  {
    const order: string[] = []
    const { d } = deps({
      findUserByEmail: async () => { order.push('lookup'); return null },
      record: async () => { order.push('record') },
      sendLink: async () => { order.push('send') },
    })
    await requestLoginLink('nobody@haevn.co', null, d)
    eq(order, ['lookup', 'record'], 'unknown email: lookup then record, never a send')
    ok(!order.includes('send'), 'generateLink is never reached for an unknown email')
  }

  // ── no address is stored, only its hash ──
  {
    const { rows } = deps()
    const { d, rows: r2 } = deps()
    await requestLoginLink('Member@Haevn.co', '1.2.3.4', d)
    eq(r2[0].email_hash, hashEmail('member@haevn.co'), 'email_hash is of the NORMALISED address')
    ok(!JSON.stringify(r2[0]).includes('Member@Haevn.co'), 'the raw address is never in the row')
    ok(!JSON.stringify(r2[0]).includes('member@haevn.co'), 'not even lowercased')
    eq(rows.length, 0, 'fixture isolation')
  }

  // ── casing: a member who types MiXeD case still resolves ──
  {
    const { d, sends } = deps()
    eq(await requestLoginLink('  MEMBER@HAEVN.CO  ', null, d), 'sent', 'mixed case + whitespace still resolves')
    eq(sends[0].to, 'member@haevn.co', 'the send uses the normalised address')
    eq(normalizeEmail('  MEMBER@HAEVN.CO  '), 'member@haevn.co', 'normalizeEmail trims and lowercases')
  }

  // ── the token: hashed at rest, raw only in the URL ──
  {
    const { d, rows, sends } = deps()
    await requestLoginLink('member@haevn.co', null, d)
    eq(rows[0].token_hash, hashHandoffToken(TOKEN), 'row stores the SHA-256 of the token')
    ok(rows[0].token_hash !== TOKEN, 'stored hash is not the raw token')
    ok(sends[0].url.includes(TOKEN), 'the raw token appears only in the emailed URL')
    ok(!JSON.stringify(rows[0]).includes(TOKEN), 'the raw token is never persisted')
    eq(rows[0].expires_at, new Date(T0 + LOGIN_LINK_TTL_MS).toISOString(), 'TTL is 15 minutes')
    eq(LOGIN_LINK_TTL_MINUTES, 15, 'the UI number matches the TTL')
  }

  // ── host: emailed links are https on www, never apex ──
  {
    const { d, sends } = deps()
    await requestLoginLink('member@haevn.co', null, d)
    ok(loginLinkUrlIsSafe(sends[0].url), 'emailed URL is https and on www')
    ok(!loginLinkUrlIsSafe(loginLinkUrl(TOKEN, 'https://haevn.app')), 'apex host is rejected')
    ok(!loginLinkUrlIsSafe(loginLinkUrl(TOKEN, 'http://www.haevn.app')), 'plain http is rejected')
  }

  // ── rate limits ──
  {
    eq(RATE_LIMIT.perEmail.max, 3, '3 sends per email')
    eq(RATE_LIMIT.perEmail.windowMs, 15 * 60 * 1000, 'per 15 minutes')
    eq(RATE_LIMIT.perIp.max, 10, '10 sends per IP')
    eq(RATE_LIMIT.perIp.windowMs, 60 * 60 * 1000, 'per hour')
    eq(checkRate({ email: 2, ip: 9 }), { allowed: true }, 'just under both limits is allowed')
    eq(checkRate({ email: 3, ip: 0 }), { allowed: false, reason: 'email' }, 'third send in the window blocks the fourth')
    eq(checkRate({ email: 0, ip: 10 }), { allowed: false, reason: 'ip' }, 'tenth send from an IP blocks the eleventh')
  }

  // ── junk input is refused without touching anything ──
  {
    for (const bad of ['', '   ', 'nope', 'a@b', 'no-at-sign.com', 'x'.repeat(300) + '@h.co']) {
      const { d, rows, sends } = deps()
      eq(await requestLoginLink(bad, null, d), 'invalid_email', `"${bad.slice(0, 16)}" → invalid_email`)
      eq(rows.length + sends.length, 0, 'malformed input writes nothing and sends nothing')
    }
    ok(looksLikeEmail('member@haevn.co'), 'a real address passes')
  }

  // ── redemption states (shared with the impersonation handoff) ──
  {
    const live = { expires_at: new Date(T0 + 60_000).toISOString(), consumed_at: null }
    eq(classifyHandoff(live, T0), 'valid', 'unconsumed and live → valid')
    eq(classifyHandoff({ ...live, consumed_at: new Date(T0).toISOString() }, T0), 'used', 'second click → used')
    eq(classifyHandoff({ ...live, expires_at: new Date(T0 - 1).toISOString() }, T0), 'expired', 'past TTL → expired')
    eq(classifyHandoff(null, T0), 'invalid', 'unknown token → invalid')
  }

  report('login-link')
}
main()
