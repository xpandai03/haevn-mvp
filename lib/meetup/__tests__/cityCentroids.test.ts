/**
 * City centroid resolution. Run: npx tsx lib/meetup/__tests__/cityCentroids.test.ts
 */
import { resolveCity, normalizeCityKey } from '../cityCentroids'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── normalization + aliases ──
eq(normalizeCityKey('  Austin '), 'austin', 'trim + lowercase')
eq(normalizeCityKey('Tampa/St. Pete'), 'tampa', 'composite label collapses to tampa')

// ── known cities resolve to a centroid + slug ──
{
  const a = resolveCity('Austin')!
  eq(a.city_id, 'austin-tx', 'austin slug')
  ok(Math.abs(a.centroid[0] - 30.2672) < 0.01 && Math.abs(a.centroid[1] + 97.7431) < 0.01, 'austin centroid')
}
{
  const p = resolveCity('portland')!
  eq(p.city_id, 'portland-or', 'portland case-insensitive')
}
{
  const t = resolveCity('Tampa/St. Pete')!
  eq(t.city_id, 'tampa-fl', 'composite tampa resolves')
}
{
  const v = resolveCity('Vancouver')!
  eq(v.city_id, 'vancouver-wa', 'ambiguous-name Vancouver pinned to WA (Portland metro)')
}

// ── unknown / ambiguous -> null (fail-safe geo_unresolved) ──
eq(resolveCity('Urbana'), null, 'deferred ambiguous city -> null')
eq(resolveCity('Atlantis'), null, 'unknown city -> null')
eq(resolveCity(null), null, 'null city -> null')
eq(resolveCity(''), null, 'empty city -> null')

report('meetup/cityCentroids')
