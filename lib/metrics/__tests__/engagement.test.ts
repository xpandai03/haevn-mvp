/**
 * Engagement person-count invariant. Run: npx tsx lib/metrics/__tests__/engagement.test.ts
 *
 * The card reads "N partnerships (M people)" — the two numbers MUST describe the
 * same population: `loggedInEverPeople` counts only signed-in MEMBERS of counted
 * partnerships, never a signed-in auth user (admin/test) who isn't in one.
 */
import { computeEngagement } from '../getMetrics'
import { eq, report } from './_assert'

// signed-in = has a (truthy) last_sign_in timestamp
const signedIn = (...users: string[]): Map<string, string | null> =>
  new Map(users.map((u) => [u, '2026-08-01T00:00:00Z'] as [string, string | null]))

function main() {
  // P1: solo m1 (signed in). P2: couple m2a+m2b (both signed in). P3: m3 (never signed in).
  // X: a signed-in user in NO partnership (admin/test account).
  const membersByP = new Map<string, string[]>([
    ['P1', ['m1']],
    ['P2', ['m2a', 'm2b']],
    ['P3', ['m3']],
  ])
  const last = signedIn('m1', 'm2a', 'm2b', 'X') // m3 NOT signed in; X not in any partnership

  const r = computeEngagement(['P1', 'P2', 'P3'], membersByP, last, null, null)
  eq(r.totalPartnerships, 3, 'all 3 partnerships in scope')
  eq(r.loggedInEverPartnerships, 2, 'P1 + P2 have a signed-in member; P3 does not')
  // THE INVARIANT: 3 people (m1, m2a, m2b) — the couple counts 2, X is EXCLUDED.
  eq(r.loggedInEverPeople, 3, 'people = signed-in members of counted partnerships only (X excluded)')
  eq(r.activeThisWeekPartnerships, null, 'no week window → null')

  // Couple effect: people (3) > partnerships (2) — the exact scenario the fix protects.
  eq(r.loggedInEverPeople > r.loggedInEverPartnerships, true, 'a logged-in couple makes people > partnerships, honestly')

  // Scope filter: only P2 in scope → 1 partnership, 2 people (the couple).
  const scoped = computeEngagement(['P1', 'P2', 'P3'], membersByP, last, new Set(['P2']), null)
  eq(scoped.totalPartnerships, 1, 'scope limits total')
  eq(scoped.loggedInEverPartnerships, 1, 'scope: only P2 counted')
  eq(scoped.loggedInEverPeople, 2, 'scope: only P2 members counted')

  // Active-this-week window.
  const wk = computeEngagement(['P1'], membersByP, last, null, { startIso: '2026-07-31T00:00:00Z', endIso: '2026-08-02T00:00:00Z' })
  eq(wk.activeThisWeekPartnerships, 1, 'm1 signed in within the week → active')
  const wkOut = computeEngagement(['P1'], membersByP, last, null, { startIso: '2026-08-10T00:00:00Z', endIso: '2026-08-16T00:00:00Z' })
  eq(wkOut.activeThisWeekPartnerships, 0, 'sign-in outside the week → not active')

  report('engagement')
}

main()
