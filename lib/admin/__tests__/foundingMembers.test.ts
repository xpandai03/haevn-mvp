/**
 * Founding Members view — funnel arithmetic, the comp/founding boundary, and
 * the admin gate.
 *
 * Run: npx tsx lib/admin/__tests__/foundingMembers.test.ts
 */
import {
  plusSourceGroup, daysToExpiry, signedInSince, summarizeFounding,
  sortByActivationDesc, pct, type FoundingRow,
} from '../foundingMembers'
import { PRIMARY_NAV, deriveActive } from '../adminNav'
import { shortName } from '../matchRows'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const NOW = new Date('2026-09-21T12:00:00.000Z')
const iso = (d: string) => new Date(d).toISOString()

const row = (o: Partial<FoundingRow> = {}): FoundingRow => ({
  partnershipId: 'p1', name: 'Alex C.', city: 'Austin', group: 'founding',
  promoMarket: 'austin', ctaSource: '/dashboard/matches',
  activatedAt: iso('2026-09-14T10:00:00Z'), expiresAt: iso('2027-03-14T10:00:00Z'),
  daysToExpiry: 174, expired: false,
  signedInSinceActivation: false, lastSignInAt: null,
  nudgesSent: 0, connectionsAccepted: 0, messagesSent: 0, ...o,
})

// ═══ group classification ══════════════════════════════════════════════════
eq(plusSourceGroup('founding_member_promo'), 'founding', 'promo -> founding')
eq(plusSourceGroup('comp'), 'comp', 'comp -> comp')
eq(plusSourceGroup('paid'), 'paid', 'paid -> paid')
eq(plusSourceGroup(null), 'other', 'null -> other, never silently founding')
eq(plusSourceGroup('something_new'), 'other', 'an unknown source is never counted as founding')

// ═══ COMPS MUST NEVER MOVE A FOUNDING NUMBER ═══════════════════════════════
// This is the one figure the client reads; a comp folded in overstates the promo.
{
  const rows = [
    row({ partnershipId: 'f1' }),
    row({ partnershipId: 'f2', signedInSinceActivation: true }),
    row({ partnershipId: 'c1', group: 'comp', signedInSinceActivation: true, connectionsAccepted: 3, messagesSent: 9 }),
    row({ partnershipId: 'c2', group: 'comp', signedInSinceActivation: true }),
    row({ partnershipId: 'x1', group: 'paid', messagesSent: 5 }),
  ]
  const s = summarizeFounding(rows, NOW)
  eq(s.total, 2, 'total counts founding ONLY (2 of 5 rows)')
  eq(s.compCount, 2, 'comps are counted separately, for display')
  eq(s.signedInSinceCount, 1, 'a comp that signed in does not raise the founding count')
  eq(s.pctSignedInSince, 50, '...so the percentage is 1/2, not 3/4')
  eq(s.connectedCount, 0, "a comp's connections are not founding connections")
  eq(s.messagedCount, 0, "neither are a comp's or a paid row's messages")
  eq(s.pctMessaged, 0, 'messaged% stays 0 — the zero is the finding, not a gap')
}

// ═══ the four percentages ══════════════════════════════════════════════════
{
  const rows = [
    row({ partnershipId: 'a', signedInSinceActivation: true, connectionsAccepted: 1, messagesSent: 2 }),
    row({ partnershipId: 'b', signedInSinceActivation: true, connectionsAccepted: 1 }),
    row({ partnershipId: 'c', signedInSinceActivation: true }),
    row({ partnershipId: 'd' }),
  ]
  const s = summarizeFounding(rows, NOW)
  eq([s.pctSignedInSince, s.pctConnected, s.pctMessaged], [75, 50, 25], 'funnel narrows 75 -> 50 -> 25')
  eq(s.total, 4, 'denominator is founding activations')
}
eq(pct(0, 0), 0, 'no activations -> 0%, never NaN or a divide-by-zero')
eq(summarizeFounding([], NOW).pctMessaged, 0, 'an empty set summarizes to zeroes, not a crash')

// ═══ "signed in since" is not "has ever signed in" ═════════════════════════
ok(signedInSince(iso('2026-09-15T00:00:00Z'), iso('2026-09-14T00:00:00Z')), 'signed in AFTER activating -> true')
ok(!signedInSince(iso('2026-09-13T00:00:00Z'), iso('2026-09-14T00:00:00Z')),
  'signed in BEFORE activating -> false (the promo did not move them)')
ok(!signedInSince(null, iso('2026-09-14T00:00:00Z')), 'never signed in -> false')
ok(!signedInSince(iso('2026-09-15T00:00:00Z'), null), 'no activation timestamp -> false')
ok(!signedInSince('garbage', iso('2026-09-14T00:00:00Z')), 'unparseable -> false, never a throw')

// ═══ expiry ════════════════════════════════════════════════════════════════
eq(daysToExpiry(iso('2026-09-28T12:00:00Z'), NOW), 7, 'seven days out')
eq(daysToExpiry(iso('2026-09-20T12:00:00Z'), NOW), -1, 'yesterday -> negative')
eq(daysToExpiry(null, NOW), null, 'no term -> null, not 0')
eq(daysToExpiry('not-a-date', NOW), null, 'unparseable -> null')
{
  // Expired memberships (none in production yet) must read as Expired, and must
  // not be offered as the "next" expiry.
  const rows = [
    row({ partnershipId: 'e', expiresAt: iso('2026-09-01T00:00:00Z'), expired: true }),
    row({ partnershipId: 'f', expiresAt: iso('2027-03-14T00:00:00Z') }),
    row({ partnershipId: 'g', expiresAt: iso('2026-12-01T00:00:00Z') }),
  ]
  const s = summarizeFounding(rows, NOW)
  eq(s.expiredCount, 1, 'expired rows are counted')
  eq(s.nextExpiryAt, iso('2026-12-01T00:00:00Z'), 'next expiry is the earliest FUTURE one')
}
eq(summarizeFounding([row({ expiresAt: null })], NOW).nextExpiryAt, null, 'no terms -> no next expiry')

// ═══ this week ═════════════════════════════════════════════════════════════
{
  const rows = [
    row({ partnershipId: '1', activatedAt: iso('2026-09-20T00:00:00Z') }),
    row({ partnershipId: '2', activatedAt: iso('2026-09-15T00:00:00Z') }),
    row({ partnershipId: '3', activatedAt: iso('2026-09-07T00:00:00Z') }),
    row({ partnershipId: '4', activatedAt: null }),
  ]
  eq(summarizeFounding(rows, NOW).activatedThisWeek, 2, 'only the last 7 days count')
}

// ═══ ordering ══════════════════════════════════════════════════════════════
{
  const sorted = sortByActivationDesc([
    row({ partnershipId: 'old', activatedAt: iso('2026-09-07T00:00:00Z') }),
    row({ partnershipId: 'none', activatedAt: null }),
    row({ partnershipId: 'new', activatedAt: iso('2026-09-20T00:00:00Z') }),
  ])
  eq(sorted.map((r) => r.partnershipId), ['new', 'old', 'none'], 'newest first; null activation sorts last')
}

// ═══ PII convention matches the other admin pages ══════════════════════════
eq(shortName('Alex Chen'), 'Alex C.', 'first name + last initial')
eq(shortName('Madonna'), 'Madonna', 'single name unchanged')
eq(shortName(null), null, 'no name -> null, never a placeholder')

// ═══ nav wiring ════════════════════════════════════════════════════════════
{
  const entry = PRIMARY_NAV.find((n) => n.key === 'founding-members')
  ok(!!entry, 'Founding Members is in the primary nav')
  eq(entry!.href, '/admin/founding-members', 'nav points at the page')
  eq(deriveActive('/admin/founding-members'), 'founding-members', 'the nav item highlights on its own path')
  eq(deriveActive('/admin/users'), 'users', 'other pages are unaffected')
  eq(deriveActive('/dashboard/matches'), null, 'a non-admin path matches nothing')
}

// ═══ THE ADMIN GATE ════════════════════════════════════════════════════════
// The page and its endpoint sit behind the same allowlist as every other admin
// surface. Asserted against the real allowlist, not a double.
{
  const { isAdminUser } = require('../allowlist')
  ok(!isAdminUser(''), 'empty email is not an admin')
  ok(!isAdminUser('attacker@example.com'), 'an arbitrary address is not an admin')
  ok(!isAdminUser('member@haevn.app'), 'a plausible-looking non-allowlisted address is not an admin')
  ok(!isAdminUser(null as any), 'null is not an admin')
  ok(!isAdminUser(undefined as any), 'undefined is not an admin')
  // The route returns the gate's 401 before it ever reads a table, so an
  // unauthenticated caller receives no rows at all.
  const routeSrc = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(), 'app/api/admin/founding-members/route.ts'), 'utf8')
  ok(/requireAdminRoute\(\)/.test(routeSrc), 'the endpoint calls requireAdminRoute')
  ok(routeSrc.indexOf('requireAdminRoute') < routeSrc.indexOf('createAdminClient()'),
    'the gate runs BEFORE any admin-client query is constructed')
  ok(/if \(!gate\.ok\) return gate\.response/.test(routeSrc), 'a failed gate returns immediately')
  ok(!/\.update\(|\.insert\(|\.upsert\(|\.delete\(/.test(routeSrc),
    'the endpoint performs NO writes — read-only by construction')
}

report('admin/foundingMembers')
