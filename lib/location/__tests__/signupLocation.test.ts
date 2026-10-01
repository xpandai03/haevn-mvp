/**
 * In-app signup location: no ZIP is ever gated. Run:
 *   npx tsx lib/location/__tests__/signupLocation.test.ts
 *
 * All markets are released. Step 3 used to accept only a hardcoded four-city
 * ZIP list and send everyone else to haevn.co/waitlist. These cases pin the
 * replacement: any well-formed US ZIP, anywhere, completes to the same live
 * location state the marketing ingest produces, and lookup failures fall back
 * to a typed city instead of blocking.
 */
import { resolveSignupLocation, partnershipLocationFields } from '../signupLocation'
import { lookupZip, normalizeZip, parseZippopotam, tidyCity } from '../zip'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const place = (zip: string, city: string, state: string) => ({ zip, city, state })

async function main() {
  // ── THE REGRESSION: an arbitrary non-Austin ZIP completes, live ──
  const kansas = resolveSignupLocation({ zip: '67013' }, place('67013', 'Belle Plaine', 'KS'))
  eq(kansas, { ok: true, zip: '67013', city: 'Belle Plaine', state: 'KS', msaStatus: 'live' }, 'rural Kansas ZIP -> live, real city')

  // Formerly hard-coded outcomes: Chicago was 'waitlist', anything unlisted was rejected.
  const chicago = resolveSignupLocation({ zip: '60601' }, place('60601', 'Chicago', 'IL'))
  ok(chicago.ok && chicago.msaStatus === 'live', 'Chicago (was waitlist) -> live')
  const montana = resolveSignupLocation({ zip: '59001' }, place('59001', 'Absarokee', 'MT'))
  ok(montana.ok && montana.msaStatus === 'live', 'unlisted Montana ZIP (was rejected) -> live')
  const austin = resolveSignupLocation({ zip: '78701' }, place('78701', 'Austin', 'TX'))
  ok(austin.ok && austin.city === 'Austin', 'Austin still works')

  // Sweep: no well-formed ZIP is ever refused for location.
  for (const zip of ['01001', '10001', '33101', '50001', '67013', '82001', '96801', '99501']) {
    const r = resolveSignupLocation({ zip }, place(zip, 'Somewhere', 'ZZ'))
    ok(r.ok && r.msaStatus === 'live', `ZIP ${zip} completes as live`)
  }

  // ── lookup missed: fall back to the typed city, never block ──
  eq(resolveSignupLocation({ zip: '67013' }, null), { ok: false, reason: 'city_required' }, 'missed lookup + no city -> ask for city')
  eq(
    resolveSignupLocation({ zip: '67013', typedCity: '  belle   plaine ' }, null),
    { ok: true, zip: '67013', city: 'Belle Plaine', state: null, msaStatus: 'live' },
    'missed lookup + typed city -> live with the typed city'
  )
  eq(resolveSignupLocation({ zip: '67013', typedCity: '123' }, null), { ok: false, reason: 'city_required' }, 'digits-only city is not a city')
  ok(!resolveSignupLocation({ zip: '67013' }, place('99999', 'Elsewhere', 'AK')).ok, 'a lookup for a different ZIP is not trusted')

  // ── malformed input is a typo, not a location decision ──
  eq(resolveSignupLocation({ zip: '6701' }, null), { ok: false, reason: 'invalid_zip' }, '4 digits -> invalid')
  eq(resolveSignupLocation({ zip: '00000' }, null), { ok: false, reason: 'invalid_zip' }, '00000 -> invalid')
  eq(normalizeZip('67013-1234'), '67013', 'ZIP+4 trimmed')
  eq(normalizeZip(' 67013 '), '67013', 'whitespace ignored')

  // ── partnership gets the same location fields the marketing ingest writes ──
  eq(partnershipLocationFields({ signup_zip: '67013', signup_state: 'ks' }), { zip_code: '67013', state: 'KS' }, 'zip + state from signup metadata')
  eq(partnershipLocationFields({ signup_zip: '67013', signup_state: null }), { zip_code: '67013' }, 'no state -> omitted, not defaulted')
  eq(partnershipLocationFields({}), {}, 'no signup metadata -> nothing invented')
  eq(partnershipLocationFields(null), {}, 'null metadata -> nothing invented')

  // ── provider parsing ──
  eq(
    parseZippopotam('67013', { places: [{ 'place name': 'Belle Plaine', 'state abbreviation': 'KS' }] }),
    { zip: '67013', city: 'Belle Plaine', state: 'KS' },
    'zippopotam body parsed'
  )
  eq(parseZippopotam('67013', {}), null, 'empty body -> null')
  eq(tidyCity('MC ALLEN'), 'Mc Allen', 'upper-case provider names title-cased')
  eq(tidyCity("o'fallon"), "O'Fallon", 'apostrophe names')

  // ── lookupZip never throws and never blocks ──
  const down = (async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch
  eq(await lookupZip('67013', down), null, 'provider down -> null (caller asks for city)')
  const notFound = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch
  eq(await lookupZip('67013', notFound), null, 'unknown ZIP -> null')
  const found = (async () =>
    new Response(JSON.stringify({ places: [{ 'place name': 'Belle Plaine', 'state abbreviation': 'KS' }] }), { status: 200 })) as unknown as typeof fetch
  eq(await lookupZip('67013', found), { zip: '67013', city: 'Belle Plaine', state: 'KS' }, 'found -> place')
  let called = false
  const spy = (async () => { called = true; return new Response('{}') }) as unknown as typeof fetch
  eq(await lookupZip('abc', spy), null, 'malformed ZIP -> null')
  ok(!called, 'malformed ZIP never hits the provider')

  report('signup-location')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
