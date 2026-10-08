/**
 * The allowlist serializer: exact key set, and nothing sensitive survives even
 * when the input row is stuffed with it. Plus primary-photo selection.
 * Run: npx tsx lib/goose/__tests__/serialize.test.ts
 */
import { eq, ok, report } from '@/lib/metrics/__tests__/_assert'
import { pickPrimaryPhotos } from '../photos'
import { GOOSE_RESULT_KEYS, findForbiddenGooseKeys, serializeGoosePair, type SerializableRow } from '../serialize'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const PHOTO_A = 'https://example.supabase.co/storage/v1/object/public/public-photos/a/1.jpg'

// ── 1. Exact key set ─────────────────────────────────────────────────────────
const out = serializeGoosePair({ member_a: A, member_b: B, score: 84 }, new Map([[A, PHOTO_A]]))
eq(Object.keys(out), [...GOOSE_RESULT_KEYS], 'serialized keys are EXACTLY the contract set, in order')
eq(
  [...GOOSE_RESULT_KEYS],
  ['member_id_a', 'member_id_b', 'compatibility_pct', 'classification', 'headline', 'considerations', 'photo_url_a', 'photo_url_b'],
  'allowlist matches contract v1.0 endpoint 5'
)
eq(out.compatibility_pct, 84, 'pct passes through')
eq(out.classification, 'Strong Alignment', 'classification from band copy')
eq(out.headline, 'A STRONG MATCH', 'headline from band copy')
eq(out.photo_url_a, PHOTO_A, 'photo a present')
eq(out.photo_url_b, null, 'photo b absent → null')
eq(findForbiddenGooseKeys(out), [], 'clean pair passes the guard')
eq(findForbiddenGooseKeys({ status: 'ready', pairs: [out] }), [], 'clean payload passes the guard')

// ── 2. A row carrying every sensitive field serializes to only approved keys ──
const poisoned = {
  member_a: A,
  member_b: B,
  score: 0,
  gated: true,
  band: 'meaningful_differences',
  engine_version: '5cat-v6',
  finalization_id: 'f',
  display_name: 'Quinn TEST-A',
  full_name: 'Quinn Secretname',
  first_name: 'Quinn',
  email: 'quinn.secret@example.com',
  member_email: 'quinn.secret@example.com',
  city: 'Portland',
  msa: 'Portland-Vancouver',
  latitude: 45.5,
  longitude: -122.6,
  constraints: { passed: false, blockedBy: 'boundaries', reason: 'User\'s interest "SECRET_KINK" conflicts with Match\'s hard boundary' },
  gate_reason: 'Health practice conflict: "SECRET_TERM_A" vs "SECRET_TERM_B"',
  categories: [{ category: 'chemistry', score: 12, subScores: [{ key: 'kinks', reason: 'Different role/kink preferences' }] }],
  breakdown: { intent: 91, chemistry: 12 },
  tier: 'Bronze',
  answers_json: { q33_kinks: ['SECRET_ANSWER'] },
  q28_hard_boundaries: ['SECRET_BOUNDARY'],
} as unknown as SerializableRow
const safe = serializeGoosePair(poisoned, new Map())
eq(Object.keys(safe), [...GOOSE_RESULT_KEYS], 'poisoned row → only the approved keys')
const json = JSON.stringify(safe)
for (const needle of ['Quinn', 'secret', 'SECRET', 'Portland', '45.5', 'boundar', 'kink', 'Health', 'Bronze', 'chemistry', 'q28', 'q33', '5cat', 'gated', 'reason']) {
  ok(!json.toLowerCase().includes(needle.toLowerCase()), `serialized output never contains "${needle}"`)
}
eq(safe.compatibility_pct, 0, 'hard-gated pair → 0')
eq(safe.classification, 'Meaningful Differences', 'gated pair → 0-59 classification')
eq(safe.headline, 'A LONG-SHOT MATCH', 'gated pair → long-shot headline')
ok(safe.considerations.startsWith('Your answers point in different directions'), 'gated pair → 0-59 considerations')

// ── 3. The runtime guard catches anything off the allowlist ──────────────────
eq(findForbiddenGooseKeys({ ...out, tier: 'Gold' }), ['pairs[0].tier'], 'extra key on a pair caught')
eq(findForbiddenGooseKeys({ status: 'ready', pairs: [out], cohort_secret: 1 }), ['payload.cohort_secret'], 'extra payload key caught')
eq(findForbiddenGooseKeys({ status: 'ready', pairs: [{ ...out, considerations: { why: 'x' } }] }), ['pairs[0].considerations<object>'], 'nested object caught')

// ── 4. Photo URL hygiene + primary-photo selection ───────────────────────────
eq(serializeGoosePair({ member_a: A, member_b: B, score: 50 }, new Map([[A, 'javascript:alert(1)'], [B, 'http://x/y.jpg']])).photo_url_a, null, 'non-https photo → null')
const picked = pickPrimaryPhotos([
  { partnership_id: 'p1', photo_url: 'https://h/p1-old.jpg', photo_type: 'public', is_primary: false, created_at: '2026-01-01T00:00:00Z' },
  { partnership_id: 'p1', photo_url: 'https://h/p1-primary.jpg', photo_type: 'public', is_primary: true, created_at: '2026-03-01T00:00:00Z' },
  { partnership_id: 'p2', photo_url: 'https://h/p2-later.jpg', photo_type: 'public', is_primary: false, created_at: '2026-02-01T00:00:00Z' },
  { partnership_id: 'p2', photo_url: 'https://h/p2-earliest.jpg', photo_type: 'public', is_primary: false, created_at: '2026-01-01T00:00:00Z' },
  { partnership_id: 'p3', photo_url: 'https://h/p3-private.jpg', photo_type: 'private', is_primary: true, created_at: '2026-01-01T00:00:00Z' },
  { partnership_id: 'p4', photo_url: 'https://h/p4-nsfw.jpg', photo_type: 'public', is_primary: true, nsfw_flag: true, created_at: '2026-01-01T00:00:00Z' },
])
eq(picked.get('p1'), 'https://h/p1-primary.jpg', 'is_primary wins over an older photo')
eq(picked.get('p2'), 'https://h/p2-earliest.jpg', 'no primary → earliest uploaded wins')
eq(picked.has('p3'), false, 'private photo never served')
eq(picked.has('p4'), false, 'nsfw-flagged photo never served')

report('goose serializer')
