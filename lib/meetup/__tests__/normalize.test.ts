/**
 * Meetup normalizers — BOTH encodings + logged unknown bucket.
 * Run: npx tsx lib/meetup/__tests__/normalize.test.ts
 *
 * Locks the encoding caveat as a contract: short codes AND full labels parse to
 * the same value, and any unrecognized token degrades gracefully (distance→null,
 * alcohol→'unknown') while being captured for logging — never a crash.
 */
import {
  normalizeMaxDistanceMiles,
  normalizeMobility,
  normalizeAlcohol,
  normalizeSocialEnergy,
  type UnknownSink,
} from '../normalize'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

function sink() {
  const seen: string[] = []
  const s: UnknownSink = { push: (f, v) => seen.push(`${f}=${v}`) }
  return { s, seen }
}

// ── q19a max distance: codes ──
eq(normalizeMaxDistanceMiles('25'), 25, 'code 25 -> 25')
eq(normalizeMaxDistanceMiles('50'), 50, 'code 50 -> 50')
eq(normalizeMaxDistanceMiles('100'), 100, 'code 100 -> 100')
eq(normalizeMaxDistanceMiles('250'), 250, 'code 250 -> 250')
eq(normalizeMaxDistanceMiles('city'), 5, 'code city -> 5 (neighborhood)')
eq(normalizeMaxDistanceMiles('int'), 9999, 'code int -> unbounded')
eq(normalizeMaxDistanceMiles('nat'), 9999, 'code nat -> unbounded')
// ── q19a: full labels ──
eq(normalizeMaxDistanceMiles('Within 25 miles'), 25, 'label 25mi -> 25')
eq(normalizeMaxDistanceMiles('Within 10 miles'), 10, 'label 10mi -> 10')
eq(normalizeMaxDistanceMiles('My neighborhood only'), 5, 'label neighborhood -> 5')
eq(normalizeMaxDistanceMiles('Any distance'), 9999, 'label any -> unbounded')
// ── q19a: unknown -> null + logged ──
{
  const { s, seen } = sink()
  eq(normalizeMaxDistanceMiles('teleport', s), null, 'unknown -> null')
  ok(seen.some((x) => x.startsWith('q19a_max_distance=')), 'unknown distance logged')
  eq(normalizeMaxDistanceMiles(null), null, 'null -> null, no crash')
}

// ── q19c mobility: codes + labels ──
eq(normalizeMobility('local'), 'local', 'code local')
eq(normalizeMobility('sometimes'), 'occasional', 'code sometimes -> occasional')
eq(normalizeMobility('freq'), 'frequent', 'code freq -> frequent')
eq(normalizeMobility('flex'), 'flexible', 'code flex -> flexible')
eq(normalizeMobility('Limited mobility - prefer local'), 'local', 'label limited -> local')
eq(normalizeMobility('Very mobile - travel frequently'), 'frequent', 'label very mobile -> frequent')
eq(normalizeMobility('It varies'), 'flexible', 'label it varies -> flexible')
{
  const { s, seen } = sink()
  eq(normalizeMobility('rocket', s), 'unknown', 'unknown mobility -> unknown')
  ok(seen.length === 1, 'unknown mobility logged')
}

// ── q18 alcohol: positive / sober / unknown, both encodings ──
eq(normalizeAlcohol(['drink']), 'positive', 'code drink -> positive')
eq(normalizeAlcohol(['Social drinker']), 'positive', 'label social drinker -> positive')
eq(normalizeAlcohol(['sober']), 'sober', 'code sober -> sober')
eq(normalizeAlcohol(['no_drink']), 'sober', 'code no_drink -> sober')
eq(normalizeAlcohol(['Sober']), 'sober', 'label Sober -> sober')
eq(normalizeAlcohol(['cann', 'no_cann']), 'unknown', 'cannabis-only -> unknown (alcohol-neutral)')
eq(normalizeAlcohol(['sober', 'drink']), 'sober', 'sober wins over drink (respect sobriety)')
eq(normalizeAlcohol([]), 'unknown', 'empty -> unknown')
eq(normalizeAlcohol(undefined), 'unknown', 'missing -> unknown')
{
  const { s, seen } = sink()
  eq(normalizeAlcohol(['moonshine'], s), 'unknown', 'unrecognized token -> unknown')
  ok(seen.some((x) => x.startsWith('q18_substances=')), 'unknown substance logged')
}

// ── q36 social energy ──
eq(normalizeSocialEnergy(4), 4, 'numeric passes')
eq(normalizeSocialEnergy('4'), null, 'string -> null (guarded)')
eq(normalizeSocialEnergy(undefined), null, 'missing -> null')

report('meetup/normalize')
