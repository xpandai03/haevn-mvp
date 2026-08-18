/**
 * Match/recommendation card redaction — the payload-contract guarantee.
 * Run: npx tsx lib/matches/__tests__/redactMatchCard.test.ts
 *
 * The security guarantee this locks: a FREE viewer's card payload carries no
 * real name, no photo URL, and no free-text identity/contact fields — only the
 * first-initial token the design shows — while a PAID viewer's payload is
 * byte-identical to the un-redacted input. Both match cards (score >= 80) and
 * recommendation cards (77–79) flow through this one transform, so testing it
 * here covers both surfaces (getRecommendationCards delegates to
 * getComputedMatchCards, which calls redactMatchPartnership on every card).
 */
import {
  redactInitial,
  redactMatchPartnership,
  hasNoIdentityLeak,
} from '../redactMatchCard'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// A representative assembled card partnership block (as getComputedMatchCards
// builds it, pre-redaction). Includes every identity vector + the demographics.
function matchCard() {
  return {
    id: 'p-123',
    display_name: 'David Martinez',
    short_bio: 'Product lead at Acme. IG @davidm.',
    connection_summary: 'David is looking for a long-term partner.',
    identity: 'single',
    city: 'Austin',
    age: 35,
    photo_url: 'https://cdn.example.com/photos/david-primary.jpg',
    membership_tier: 'plus' as const,
    first_name: 'David',
    gender: 'Man',
    sexuality: 'Straight',
    relationship_structure: 'Monogamous',
    distance_miles: 4,
  }
}

// A recommendation-band card (77–79). Same shape/transform — assert it redacts too.
function recCard() {
  return { ...matchCard(), id: 'p-777', first_name: 'Priya', display_name: 'Priya K' }
}

// ── redactInitial ──
eq(redactInitial('David'), 'D***', 'first name -> initial token')
eq(redactInitial('david martinez'), 'D***', 'lowercases + first initial only')
eq(redactInitial('David & Sarah'), 'D***', 'couple display name -> single initial, no partner names')
eq(redactInitial(null), '—', 'null name -> em dash, never empty leak')
eq(redactInitial('  '), '—', 'blank name -> em dash')

// ── FREE viewer: full redaction (matches) ──
{
  const out = redactMatchPartnership(matchCard(), true)
  eq(out.display_name, null, 'free: display_name stripped')
  eq(out.first_name, 'D***', 'free: only the initial token remains')
  eq(out.photo_url, undefined, 'free: photo URL stripped')
  eq(out.short_bio, null, 'free: bio (may hold employer/handle) stripped')
  eq(out.connection_summary, null, 'free: connection summary stripped')
  // Non-identifying demographics the card is designed to show survive:
  eq(out.gender, 'Man', 'free: gender preserved')
  eq(out.sexuality, 'Straight', 'free: orientation preserved')
  eq(out.relationship_structure, 'Monogamous', 'free: structure preserved')
  eq(out.age, 35, 'free: age preserved')
  eq(out.city, 'Austin', 'free: city preserved')
  eq(out.distance_miles, 4, 'free: banded distance preserved')
  ok(hasNoIdentityLeak(out), 'free: payload has zero identity leak')
  // Hard assertion: no field anywhere still contains the real name.
  ok(
    !JSON.stringify(out).includes('David') &&
      !JSON.stringify(out).includes('Martinez'),
    'free: serialized payload contains no fragment of the real name',
  )
  ok(
    !JSON.stringify(out).toLowerCase().includes('http'),
    'free: serialized payload contains no photo URL',
  )
}

// ── FREE viewer: recommendation card redacts identically ──
{
  const out = redactMatchPartnership(recCard(), true)
  eq(out.display_name, null, 'free/rec: display_name stripped')
  eq(out.first_name, 'P***', 'free/rec: initial token')
  eq(out.photo_url, undefined, 'free/rec: photo stripped')
  ok(hasNoIdentityLeak(out), 'free/rec: zero identity leak')
  ok(!JSON.stringify(out).includes('Priya'), 'free/rec: no real name fragment')
}

// ── PAID viewer: byte-identical passthrough ──
{
  const input = matchCard()
  const out = redactMatchPartnership(input, false)
  eq(out, input, 'paid: payload deep-equals the un-redacted input (no behavior change)')
  ok(out === input, 'paid: same object reference (true passthrough)')
  ok(!hasNoIdentityLeak(out), 'paid: identity intentionally present for entitled viewer')
}

// ── Edge: missing name still cannot leak, still valid token ──
{
  const out = redactMatchPartnership({ ...matchCard(), first_name: '', display_name: null }, true)
  eq(out.first_name, '—', 'free: missing name -> em dash token, no crash')
  ok(hasNoIdentityLeak(out), 'free: missing name still leak-free')
}

report('redactMatchCard')
