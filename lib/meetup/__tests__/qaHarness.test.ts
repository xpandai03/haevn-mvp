/**
 * Meetup Spots QA harness — the contract, the privacy boundary, and the
 * production-safety gate that lets fixtures exist in a shared database.
 *
 * Run: npx tsx lib/meetup/__tests__/qaHarness.test.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createHmac } from 'crypto'
import { isQaFixture, includeInFeed, qaHarnessEnabled, qaFixturesOnly, QA_FIXTURE_BADGE } from '../qaFixtures'
import { assembleMeetupRecord } from '../assemble'
import { computePairId } from '../pairId'
import { resolveCity } from '../cityCentroids'
import {
  findForbiddenKeys, MEETUP_CATEGORIES,
  ALLOWED_PAYLOAD_KEYS, ALLOWED_RECORD_KEYS, ALLOWED_MEMBER_KEYS, ALLOWED_CATEGORY_KEYS,
  type MeetupFeedPayload,
} from '../types'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const buildFeed = code('lib/meetup/buildFeed.ts')
const mockRoute = code('app/api/qa/mock-emergent/route.ts')
const seed = code('scripts/qa/seed-meetup-fixtures.ts')

const member = (over: Record<string, any> = {}) => ({
  role: 'a' as const,
  city_id: 'austin-tx', city_label: 'Austin, TX', centroid: [30.2672, -97.7431] as [number, number],
  max_distance_miles: 25, mobility: 'frequent', geo_unresolved: false,
  // Deliberately hostile rubric inputs: these MUST be consumed, never emitted.
  rubric: { alcohol: 'positive' as const, socialEnergy: 4 },
  ...over,
})

function main() {
  // ══ 1. PRODUCTION-SAFETY GATE ════════════════════════════════════════════
  // Preview shares production's database. This gate is the only thing that
  // keeps a fixture out of production's pair_count, so it is the single most
  // important assertion in this file.
  ok(isQaFixture([QA_FIXTURE_BADGE]), 'the badge marks a fixture')
  ok(isQaFixture(['other', 'qa_fixture']), 'badge match is case-insensitive')
  ok(!isQaFixture([]), 'an empty badge list is a real partnership')
  ok(!isQaFixture(null), 'null badges -> real partnership')
  ok(!isQaFixture(undefined), 'undefined badges -> real partnership')
  ok(!isQaFixture('QA_FIXTURE'), 'a bare string is not a badge array — fails safe as REAL')

  const PROD = {} as any
  const PREVIEW = { QA_HARNESS_ENABLED: 'true' } as any
  ok(!qaHarnessEnabled(PROD), 'harness is OFF when unset — production')
  ok(!qaHarnessEnabled({ QA_HARNESS_ENABLED: 'TRUE' } as any), "only exact 'true' enables the harness")
  ok(!qaHarnessEnabled({ QA_HARNESS_ENABLED: '1' } as any), "'1' does not enable the harness")
  ok(qaHarnessEnabled(PREVIEW), "'true' enables the harness")

  ok(includeInFeed([], PROD), 'production includes real partnerships')
  ok(!includeInFeed([QA_FIXTURE_BADGE], PROD), 'PRODUCTION EXCLUDES FIXTURES — the load-bearing case')
  ok(includeInFeed([QA_FIXTURE_BADGE], PREVIEW), 'the preview harness includes fixtures')
  ok(includeInFeed([], PREVIEW), 'the harness still includes real partnerships')

  // Fixtures-only: a deterministic QA payload, and unreachable from production.
  const ONLY = { QA_HARNESS_ENABLED: 'true', QA_FIXTURES_ONLY: 'true' } as any
  ok(qaFixturesOnly(ONLY), 'fixtures-only is on when both flags are set')
  ok(!qaFixturesOnly({ QA_FIXTURES_ONLY: 'true' } as any),
    'fixtures-only is INERT without the harness flag — production can never reach it')
  ok(includeInFeed([QA_FIXTURE_BADGE], ONLY), 'fixtures-only includes fixtures')
  ok(!includeInFeed([], ONLY), 'fixtures-only EXCLUDES real partnerships')
  ok(includeInFeed([], PROD), 'production still includes real partnerships regardless')

  // Wired into the builder, and the builder reads the column it needs.
  ok(/includeInFeed\(p\.badges\)/.test(buildFeed), 'buildMeetupFeed applies the gate')
  ok(/'id, owner_id, city, badges'/.test(buildFeed), 'the builder selects badges')
  ok(/qaFixturesExcluded/.test(buildFeed), 'exclusions are counted and reported in stats')
  // A pair is dropped when EITHER side is excluded, via the existing has() filter.
  ok(/partById\.has\(p\.a\) && partById\.has\(p\.b\)/.test(buildFeed),
    'a pair survives only if BOTH partnerships are in the lookup')

  // ══ 2. PAYLOAD CONTRACT ══════════════════════════════════════════════════
  const rec = assembleMeetupRecord({
    pair_id: computePairId('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'salt'),
    type: 'match',
    memberA: member(),
    memberB: member({ role: 'b', city_id: null, city_label: null, centroid: null, geo_unresolved: true, max_distance_miles: null, mobility: 'unknown' }),
  })
  const payload: MeetupFeedPayload = {
    snapshot_date: '2026-09-11', generated_at: new Date().toISOString(), pair_count: 1, pairs: [rec],
  }

  eq(Object.keys(payload).sort(), [...ALLOWED_PAYLOAD_KEYS].sort(), 'payload has exactly the contracted top-level keys')
  eq(Object.keys(rec).sort(), [...ALLOWED_RECORD_KEYS].sort(), 'record has exactly the contracted keys')
  eq(Object.keys(rec.members[0]).sort(), [...ALLOWED_MEMBER_KEYS].sort(), 'member has exactly the contracted keys')
  eq(rec.members.length, 2, 'a record always carries exactly two members')
  eq(rec.members[0].role, 'a', "role 'a' is the smaller canonical partnership id")
  eq(rec.members[1].role, 'b', "role 'b' is the larger")
  eq(rec.active, true, 'active is always true in the emitted set')
  ok(['match', 'recommendation'].includes(rec.type), 'type is match | recommendation')
  for (const c of rec.qualified_meetup_categories) {
    eq(Object.keys(c).sort(), [...ALLOWED_CATEGORY_KEYS].sort(), 'category has exactly {category, confidence}')
    ok((MEETUP_CATEGORIES as readonly string[]).includes(c.category), `${c.category} is an allowed category`)
    ok(['high', 'normal', 'low_confidence'].includes(c.confidence), 'confidence is one of the three values')
  }
  eq(findForbiddenKeys(payload), [], 'no forbidden key anywhere in the payload')

  // ── the hotel rule ──
  ok(!(MEETUP_CATEGORIES as readonly string[]).includes('hotel'), 'hotel is NOT an emitted category (standing rule)')
  ok(!/hotel/i.test(JSON.stringify(payload)), 'no hotel appears anywhere in a serialized payload')

  // ── privacy: hostile inputs must not survive ──
  const hostile = assembleMeetupRecord({
    pair_id: 'deadbeef', type: 'recommendation',
    memberA: { ...member(), ...({ display_name: 'Jane Real', email: 'jane@example.com', partnership_id: 'uuid-1' } as any) },
    memberB: { ...member({ role: 'b' }), ...({ full_name: 'John Real', user_id: 'uuid-2', phone: '+15125551234' } as any) },
  })
  const serialized = JSON.stringify({ snapshot_date: 'x', generated_at: 'y', pair_count: 1, pairs: [hostile] })
  eq(findForbiddenKeys(JSON.parse(serialized)), [], 'extra identity fields on the INPUT never reach the output')
  for (const leak of ['Jane Real', 'John Real', 'jane@example.com', 'uuid-1', 'uuid-2', '+15125551234', 'alcohol', 'socialEnergy', 'rubric']) {
    ok(!serialized.includes(leak), `"${leak}" does not appear in the serialized payload`)
  }

  // ── pair_id: salted, stable, direction-independent, unlinkable ──
  const A = '33333333-3333-3333-3333-333333333333'
  const B = '44444444-4444-4444-4444-444444444444'
  eq(computePairId(A, B, 's'), computePairId(B, A, 's'), 'pair_id is direction-independent')
  eq(computePairId(A, B, 's'), computePairId(A, B, 's'), 'pair_id is stable across runs')
  ok(computePairId(A, B, 's1') !== computePairId(A, B, 's2'), 'a different salt yields a different id')
  ok(!computePairId(A, B, 's').includes(A) && !computePairId(A, B, 's').includes(B),
    'the raw partnership ids do not appear in the pair_id')
  ok(/^[0-9a-f]{64}$/.test(computePairId(A, B, 's')), 'pair_id is a 64-char hex HMAC-SHA256')

  // ══ 3. GEO — resolve, and never drop ═════════════════════════════════════
  ok(resolveCity('Austin') !== null, 'Austin resolves to a centroid (live market)')
  ok(resolveCity('Portland') !== null, 'Portland resolves to a centroid (pre-launch market)')
  eq(resolveCity('Centreville'), null, 'Centreville is deliberately unresolved (ambiguous across states)')
  eq(resolveCity('Round Rock') !== null, true, 'Round Rock resolves')
  eq(resolveCity(null), null, 'a null city is unresolved, not a crash')

  const unresolved = rec.members[1]
  eq(unresolved.geo_unresolved, true, 'an unresolved member is flagged')
  eq(unresolved.centroid, null, '...carries a null centroid')
  eq(unresolved.city_id, null, '...and a null city_id')
  eq(rec.members.length, 2, 'BUT IS STILL PRESENT — unresolved members are never dropped')

  // ══ 4. MOCK RECEIVER ═════════════════════════════════════════════════════
  // Gate 1 must come first and must 404, so production cannot even fingerprint it.
  const postBody = mockRoute.slice(mockRoute.indexOf('export async function POST'))
  const gateIdx = postBody.indexOf('qaHarnessEnabled()')
  const secretIdx = postBody.indexOf('qaSecretOk(request)')
  ok(gateIdx > -1 && secretIdx > gateIdx, 'the harness flag is checked BEFORE the QA secret')
  ok(/return NOT_FOUND\(\)/.test(postBody), 'a disabled harness returns 404, not 403')
  ok(/status: 404/.test(mockRoute), 'NOT_FOUND is a real 404')
  for (const verb of ['POST', 'GET', 'DELETE']) {
    const seg = mockRoute.slice(mockRoute.indexOf(`export async function ${verb}`))
    ok(/qaHarnessEnabled\(\)/.test(seg.slice(0, 400)), `${verb} is gated by the harness flag`)
    ok(/qaSecretOk/.test(seg.slice(0, 600)), `${verb} is gated by the QA secret`)
  }
  ok(/timingSafeEqual/.test(mockRoute), 'secret and signature comparisons are constant-time')
  ok(/if \(!expected\) return false/.test(mockRoute), 'an unset QA secret never authorises')
  ok(/findForbiddenKeys/.test(mockRoute), 'the receiver independently re-runs the privacy allowlist')
  ok(/fail === 'auth'|failMode === 'auth'/.test(mockRoute), 'a forced auth-failure mode exists')
  ok(/failMode === '1'/.test(mockRoute), 'a forced 500 mode exists (?fail=1)')
  // The forced 500 must come AFTER the record is stored, or the failure path
  // would leave the QA agent with nothing to inspect.
  // Anchor on the BRANCH, not the `forced_failure: failMode === '1'` field that
  // is recorded earlier in the same function.
  const insertIdx = postBody.indexOf('.insert({ event_type: QA_RECEIVED_EVENT')
  const forcedBranchIdx = postBody.indexOf("if (failMode === '1')")
  ok(insertIdx > -1 && forcedBranchIdx > insertIdx,
    'a forced failure still stores the receipt first')

  // ── the signature the receiver verifies is the one the sender sends ──
  const ts = String(Math.floor(Date.now() / 1000))
  const body = JSON.stringify(payload)
  const secret = 'throwaway-secret'
  const senderSig = `sha256=${createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`
  const receiverSig = `sha256=${createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`
  eq(senderSig, receiverSig, 'sender and receiver derive the identical signature over `${ts}.${body}`')
  ok(/\$\{timestamp\}\.\$\{rawBody\}/.test(mockRoute), 'the receiver signs timestamp.body, matching pushMeetupFeed')
  ok(/\$\{timestamp\}\.\$\{rawBody\}/.test(buildFeed), 'the sender signs timestamp.body')
  ok(/X-HAEVN-Signature/i.test(buildFeed) && /x-haevn-signature/i.test(mockRoute), 'both sides use X-HAEVN-Signature')
  ok(/X-HAEVN-Timestamp/i.test(buildFeed) && /x-haevn-timestamp/i.test(mockRoute), 'both sides use X-HAEVN-Timestamp')

  // ══ 5. FIXTURES ══════════════════════════════════════════════════════════
  ok(/profile_state: 'draft'/.test(seed), "fixtures are 'draft' — they can never enter a recompute")
  ok(/badges: \[QA_FIXTURE_BADGE\]/.test(seed), 'fixtures carry the exclusion badge')
  ok(/qa\.invalid/.test(seed), 'fixture emails are on a reserved .invalid domain')
  ok(/TEST-/.test(seed), 'fixture names carry the TEST- prefix teardown keys off')
  for (const city of ['Austin', 'Portland', 'Centreville']) {
    ok(new RegExp(`'${city}'`).test(seed), `fixtures cover ${city}`)
  }
  ok(/released: false/.test(seed), 'an unreleased pair is seeded (must be excluded from the feed)')
  ok(/70/.test(seed), 'a below-threshold pair is seeded (must be excluded from the feed)')

  report('meetup-qa-harness')
}
main()
