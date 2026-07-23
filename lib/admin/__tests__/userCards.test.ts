/**
 * /admin/users directory logic. Run: npx tsx lib/admin/__tests__/userCards.test.ts
 */
import {
  surveyStatusOf, initialsOf, filterUsers, sortUsers, paginate, summarize,
  type UserCard,
} from '../userCards'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── survey status (PR #7 completion_pct) ─────────────────────────────────────
eq(surveyStatusOf(100), 'complete', '100 → complete')
eq(surveyStatusOf(150), 'complete', '150 → complete')
eq(surveyStatusOf(99), 'in_progress', '99 → in progress')
eq(surveyStatusOf(1), 'in_progress', '1 → in progress')
eq(surveyStatusOf(0), 'not_started', '0 → not started')
eq(surveyStatusOf(null), 'not_started', 'null → not started')

// ── initials fallback ────────────────────────────────────────────────────────
eq(initialsOf('Alex Chen'), 'AC', 'first + last initial')
eq(initialsOf('Cher'), 'C', 'single name → one initial')
eq(initialsOf('  mary jane watson '), 'MW', 'multi → first + LAST initial, uppercased')
eq(initialsOf(null), '?', 'null → ?')
eq(initialsOf(''), '?', 'empty → ?')

// ── row factory ──────────────────────────────────────────────────────────────
function u(o: Partial<UserCard>): UserCard {
  return {
    userId: 'u1', name: 'Alex Chen', email: 'alex@x.com', memberSince: '2026-06-01T00:00:00Z',
    city: 'Austin', market: 'Austin–Round Rock MSA', tier: 'free', partnerName: null,
    surveyStatus: 'complete', completionPct: 100, lastSignInAt: '2026-07-20T00:00:00Z',
    photoUrl: 'https://x/p.jpg', initials: 'AC', partnershipId: 'p1', ...o,
  }
}
const AUS = 'Austin–Round Rock MSA'
const rows: UserCard[] = [
  u({ userId: '1', name: 'Alex Chen', email: 'alex@x.com', surveyStatus: 'complete', lastSignInAt: '2026-07-20T00:00:00Z', tier: 'pro', market: AUS, photoUrl: 'p' }),
  u({ userId: '2', name: 'Bea Lin', email: 'bea@y.com', surveyStatus: 'in_progress', lastSignInAt: null, tier: 'free', market: AUS, photoUrl: null }),
  u({ userId: '3', name: 'Cy Ng', email: 'cy@z.com', surveyStatus: 'not_started', lastSignInAt: null, tier: 'free', market: null, photoUrl: null }),
]

// ── filter ───────────────────────────────────────────────────────────────────
eq(filterUsers(rows, { survey: 'complete' }).map((r) => r.userId), ['1'], 'survey=complete')
eq(filterUsers(rows, { login: 'ever' }).map((r) => r.userId), ['1'], 'login=ever')
eq(filterUsers(rows, { login: 'never' }).map((r) => r.userId), ['2', '3'], 'login=never')
eq(filterUsers(rows, { tier: 'pro' }).map((r) => r.userId), ['1'], 'tier=pro')
eq(filterUsers(rows, { photo: 'has' }).map((r) => r.userId), ['1'], 'photo=has')
eq(filterUsers(rows, { photo: 'none' }).map((r) => r.userId), ['2', '3'], 'photo=none')
eq(filterUsers(rows, { market: AUS }).map((r) => r.userId), ['1', '2'], 'market=Austin')
eq(filterUsers(rows, { market: 'unresolved' }).map((r) => r.userId), ['3'], 'market=unresolved')
eq(filterUsers(rows, { search: 'bea@y' }).map((r) => r.userId), ['2'], 'search by email')
eq(filterUsers(rows, { search: 'cy ng' }).map((r) => r.userId), ['3'], 'search by name')
eq(filterUsers(rows, { search: '2' }).map((r) => r.userId), ['2'], 'search by member id')

// ── sort ─────────────────────────────────────────────────────────────────────
eq(sortUsers(rows, 'name', 'asc').map((r) => r.name), ['Alex Chen', 'Bea Lin', 'Cy Ng'], 'name asc')
eq(sortUsers(rows, 'last_sign_in', 'desc')[0].userId, '1', 'last_sign_in desc → logged-in first')

// ── paginate + summary ───────────────────────────────────────────────────────
{
  const p = paginate(rows, 2, 2)
  eq(p.total, 3, 'paginate total')
  eq(p.pageRows.map((r) => r.userId), ['3'], 'paginate page 2 size 2')
}
{
  const sm = summarize(rows)
  eq(sm.total, 3, 'summary total')
  eq(sm.withPhoto, 1, 'summary withPhoto')
  eq(sm.completedSurvey, 1, 'summary completedSurvey')
  eq(sm.loggedInEver, 1, 'summary loggedInEver')
}

report('userCards')
