/**
 * matching_excluded regression guard. Run:
 *   npx tsx lib/matching/__tests__/exclusion.test.ts
 *
 * An operator account (partnerships.matching_excluded = true) must NEVER appear
 * in a match candidate pool, the weekly compute loop, the no-match ping
 * audience, or the re-notify audience, even when it otherwise qualifies for each
 * one (live, surveyed, never logged in, released and notified rows, reachable).
 */
import { buildRecomputeContext } from '../../services/computeMatches'
import { buildNoMatchAudience, liveMembersByCity } from '../../notify/noMatchAudience'
import { buildAudience } from '../../renotify/audience'
import { isMatchingExcluded } from '../exclusion'
import type { MarketIndex } from '../../markets/releaseGate'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const EXCLUDED = 'p-underwriting'
const AUSTIN = 'Austin–Round Rock MSA'
const NOW = new Date('2026-10-05T16:00:00.000Z')

const marketIdx: MarketIndex = {
  cityToMarket: new Map([['austin', AUSTIN]]),
  liveMarkets: new Set([AUSTIN]),
  ok: true,
}

// Every row qualifies for everything; only the flag differs.
const partnerships = [
  { id: 'p-a', city: 'Austin', phone: '+15125550101', profile_state: 'live', no_match_notified_at: null, matching_excluded: false, profile_type: 'solo', msa: null, display_name: 'A', latitude: null, longitude: null },
  { id: 'p-b', city: 'Austin', phone: '+15125550102', profile_state: 'live', no_match_notified_at: null, matching_excluded: false, profile_type: 'solo', msa: null, display_name: 'B', latitude: null, longitude: null },
  { id: EXCLUDED, city: 'Austin', phone: '+15125550103', profile_state: 'live', no_match_notified_at: null, matching_excluded: true, profile_type: 'solo', msa: null, display_name: 'U', latitude: null, longitude: null },
]
const members = [
  { partnership_id: 'p-a', user_id: 'u-a' },
  { partnership_id: 'p-b', user_id: 'u-b' },
  { partnership_id: EXCLUDED, user_id: 'u-x' },
]
const profiles = [
  { user_id: 'u-a', email: 'a@example.test', full_name: 'A' },
  { user_id: 'u-b', email: 'b@example.test', full_name: 'B' },
  { user_id: 'u-x', email: 'x@example.test', full_name: 'U' },
]
const surveys = members.map((m) => ({ user_id: m.user_id, answers_json: { q: 1 }, completion_pct: 100 }))

/**
 * Supabase double that HONOURS eq/neq/in, so a filter missing from a query is
 * visible as a wrong result rather than silently passing.
 */
function fakeAdmin(tables: Record<string, any[]>) {
  const filtersSeen: Record<string, string[]> = {}
  const client: any = {
    from(table: string) {
      const preds: ((r: any) => boolean)[] = []
      const seen = (filtersSeen[table] ??= [])
      const run = (from = 0, to = Number.MAX_SAFE_INTEGER) =>
        Promise.resolve({ data: (tables[table] ?? []).filter((r) => preds.every((p) => p(r))).slice(from, to + 1), error: null })
      const b: any = {
        select: () => b,
        eq: (col: string, v: unknown) => { seen.push(`eq:${col}`); preds.push((r) => r[col] === v); return b },
        neq: (col: string, v: unknown) => { preds.push((r) => r[col] !== v); return b },
        in: (col: string, vs: unknown[]) => { preds.push((r) => vs.includes(r[col])); return b },
        or: () => b,
        order: () => b,
        limit: () => b,
        range: (from: number, to: number) => run(from, to),
        then: (resolve: (r: any) => void, reject?: (e: any) => void) => run().then(resolve, reject),
      }
      return b
    },
    auth: { admin: { listUsers: async () => ({ data: { users: [] } }) } },
  }
  return { client, filtersSeen }
}

async function main() {
  // ── helper ──
  ok(isMatchingExcluded({ matching_excluded: true }), 'true is excluded')
  ok(!isMatchingExcluded({ matching_excluded: false }), 'false is not excluded')
  ok(!isMatchingExcluded({ matching_excluded: null }), 'null is not excluded')
  ok(!isMatchingExcluded({}), 'missing column is not excluded')
  ok(!isMatchingExcluded(null), 'missing row is not excluded')

  // ── 1. weekly compute: candidate pool AND loop list ──
  {
    const { client, filtersSeen } = fakeAdmin({
      partnerships,
      partnership_members: members,
      user_survey_responses: surveys,
      profiles,
      handshakes: [],
    })
    const ctx = await buildRecomputeContext(client)
    const ids = ctx.livePartnerships.map((p) => p.id)
    ok(filtersSeen.partnerships.includes('eq:matching_excluded'), 'recompute pool query filters matching_excluded')
    ok(!ids.includes(EXCLUDED), 'excluded partnership is NOT in the recompute pool / loop')
    ok(!ctx.partnershipsById.has(EXCLUDED), 'excluded partnership is not addressable by id in ctx')
    eq(ids.sort(), ['p-a', 'p-b'], 'every other live partnership stays in the pool')
    // The pool for any member, as computeMatchesForPartnership derives it in batch mode:
    const poolForA = ctx.livePartnerships.filter((p) => p.id !== 'p-a').map((p) => p.id)
    ok(!poolForA.includes(EXCLUDED), 'excluded partnership is not a candidate for another member')
  }

  // ── 2. no-match ping audience ──
  {
    const { client } = fakeAdmin({
      partnerships,
      computed_matches: [],
      partnership_members: members,
      profiles,
      email_suppressions: [],
    })
    const env = { NO_MATCH_PING_ENABLED: 'true', NO_MATCH_PING_EVERY_N_WEEKS: '1', NO_MATCH_DENSITY_THRESHOLD: '1' } as any
    const res = await buildNoMatchAudience(client, { now: NOW, env, marketIdx })
    const ids = res.audience.map((e: any) => e.partnershipId)
    ok(!ids.includes(EXCLUDED), 'excluded partnership is NOT in the no-match ping audience')
    ok(!res.unreachable.includes(EXCLUDED), 'excluded partnership is not even counted as unreachable')
    eq(ids.sort(), ['p-a', 'p-b'], 'everyone else still gets the ping')

    const density = liveMembersByCity(partnerships)
    eq(density.get('austin'), 2, 'excluded account does not count toward city density')
  }

  // ── 3. re-notify audience (bypasses sendNotification, so it must filter itself) ──
  {
    const released = '2026-09-28T12:00:00.000Z'
    const notified = '2026-09-28T14:00:00.000Z'
    const { client } = fakeAdmin({
      partnerships,
      computed_matches: partnerships.map((p) => ({ partnership_a: p.id, release_at: released, sms_notified_at: notified })),
      partnership_members: members,
      profiles,
      email_suppressions: [],
    })
    const neverLoggedIn = new Set<string>()
    const { audience } = await buildAudience(client, neverLoggedIn, NOW, marketIdx)
    const ids = audience.map((e: any) => e.partnershipId)
    ok(!ids.includes(EXCLUDED), 'excluded partnership is NOT in the re-notify audience')
    eq(ids.sort(), ['p-a', 'p-b'], 'everyone else still qualifies for re-notify')
  }

  report('matching-exclusion')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
