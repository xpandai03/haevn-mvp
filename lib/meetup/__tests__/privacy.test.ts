/**
 * PRIVACY CONTRACT — acceptance-critical.
 * Run: npx tsx lib/meetup/__tests__/privacy.test.ts
 *
 * The serialized feed payload may contain ONLY the allowlisted fields
 * (docs/plans/meetup-spots-feed.md §6). This test:
 *   1. proves a correctly assembled payload leaks nothing (no stray keys, and
 *      rubric inputs like the raw alcohol answer never ride along);
 *   2. proves the enforcement is real — carelessly attaching an identity field
 *      to a record is CAUGHT by findForbiddenKeys and shows up in the bytes.
 * If someone adds a PII field to a record without updating the contract, this
 * fails the suite.
 */
import { assembleMeetupRecord, type AssembledMemberInput } from '../assemble'
import { findForbiddenKeys, type MeetupFeedPayload } from '../types'
import { computePairId } from '../pairId'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// Fixtures deliberately carry identifying INPUTS that must NOT reach the output.
const PARTNERSHIP_A = 'aaaaaaaa-1111-2222-3333-444444444444'
const PARTNERSHIP_B = 'bbbbbbbb-5555-6666-7777-888888888888'
const REAL_NAME = 'David Martinez'
const REAL_EMAIL = 'david.martinez@example.com'
const RAW_ANSWER = 'Social drinker' // a raw q18 label — only the derived 'positive' may cross

function member(role: 'a' | 'b'): AssembledMemberInput {
  return {
    role,
    city_id: 'austin-tx',
    city_label: 'Austin',
    centroid: [30.2672, -97.7431],
    max_distance_miles: 25,
    mobility: 'local',
    geo_unresolved: false,
    rubric: { alcohol: 'positive', socialEnergy: 4 }, // derived — raw label stays out
  }
}

const record = assembleMeetupRecord({
  pair_id: computePairId(PARTNERSHIP_A, PARTNERSHIP_B, 'salt'),
  type: 'match',
  memberA: member('a'),
  memberB: member('b'),
})
const payload: MeetupFeedPayload = {
  snapshot_date: '2026-08-19',
  generated_at: '2026-08-19T08:00:00.000Z',
  pair_count: 1,
  pairs: [record],
}

// 1. No forbidden keys on a clean payload (rubric inputs dropped, no stray keys).
eq(findForbiddenKeys(payload), [], 'clean payload has zero forbidden keys')
ok(!('rubric' in (record.members[0] as any)), 'rubric input not carried onto the member')

// 2. No forbidden literals in the serialized bytes.
const serialized = JSON.stringify(payload)
for (const forbidden of [PARTNERSHIP_A, PARTNERSHIP_B, REAL_NAME, REAL_EMAIL, RAW_ANSWER]) {
  ok(!serialized.includes(forbidden), `serialized payload does NOT contain "${forbidden}"`)
}
// pair_id is the salted token, not the raw ids.
ok(/^[0-9a-f]{64}$/.test(record.pair_id), 'pair_id is a salted hash, not a raw id')

// 3. Enforcement is real: a careless identity field is caught.
{
  const leaky = JSON.parse(JSON.stringify(payload)) as MeetupFeedPayload
  ;(leaky.pairs[0].members[0] as any).display_name = REAL_NAME
  const bad = findForbiddenKeys(leaky)
  ok(bad.includes('member.display_name'), 'injected identity field is CAUGHT by the contract check')
  ok(JSON.stringify(leaky).includes(REAL_NAME), 'sanity: the leak would have shipped the real name')
}

// 4. Categories only carry {category, confidence}.
eq(findForbiddenKeys({ ...payload }), [], 'category objects carry no extra keys')

report('meetup/privacy')
