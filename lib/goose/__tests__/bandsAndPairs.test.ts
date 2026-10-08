/**
 * Band selection at every boundary, verbatim copy pin, pair math, coverage.
 * Run: npx tsx lib/goose/__tests__/bandsAndPairs.test.ts
 */
import { createHash } from 'crypto'
import { eq, ok, report } from '@/lib/metrics/__tests__/_assert'
import { GOOSE_BAND_COPY, gooseBandFor } from '../gooseBandCopy'
import { canonicalPair, countCoverage, enumeratePairs, expectedPairs, isComplete, populationHash } from '../pairs'

// ── Verbatim copy pin ────────────────────────────────────────────────────────
// sha256 over "classification|headline|considerations" rows (90-100 … 0-59),
// computed from the locked contract v1.0 band table. Any wording drift fails.
const CONTRACT_COPY_SHA256 = '8f7fa107b96f7869ba4fd3b2ac9eeb54b61bcfbe5b2cb8933d2b649dbfd46614'
const joined = GOOSE_BAND_COPY.map((b) => [b.classification, b.headline, b.considerations].join('|')).join('\n')
eq(createHash('sha256').update(joined).digest('hex'), CONTRACT_COPY_SHA256, 'band copy is verbatim contract v1.0')
eq(GOOSE_BAND_COPY.map((b) => `${b.min}-${b.max}`), ['90-100', '80-89', '70-79', '60-69', '0-59'], 'band ranges')

// ── Boundaries ───────────────────────────────────────────────────────────────
const cases: Array<[number, string, string]> = [
  [0, 'meaningful_differences', 'A LONG-SHOT MATCH'],
  [38, 'meaningful_differences', 'A LONG-SHOT MATCH'],
  [59, 'meaningful_differences', 'A LONG-SHOT MATCH'],
  [60, 'some_differences', 'A MIXED MATCH'],
  [69, 'some_differences', 'A MIXED MATCH'],
  [70, 'compatible', 'A COMPATIBLE MATCH'],
  [79, 'compatible', 'A COMPATIBLE MATCH'],
  [80, 'strong', 'A STRONG MATCH'],
  [89, 'strong', 'A STRONG MATCH'],
  [90, 'exceptional', 'AN EXCEPTIONAL MATCH'],
  [100, 'exceptional', 'AN EXCEPTIONAL MATCH'],
]
for (const [score, band, headline] of cases) {
  eq(gooseBandFor(score).band, band, `score ${score} → ${band}`)
  eq(gooseBandFor(score).headline, headline, `score ${score} headline`)
}
eq(gooseBandFor(-4).band, 'meaningful_differences', 'negative clamps to 0 band')
eq(gooseBandFor(140).band, 'exceptional', 'over 100 clamps to top band')
eq(gooseBandFor(NaN).band, 'meaningful_differences', 'NaN reads as 0, never throws')
eq(gooseBandFor(59.4).band, 'meaningful_differences', '59.4 rounds to 59')
eq(gooseBandFor(59.5).band, 'some_differences', '59.5 rounds to 60')

// ── Pair math ────────────────────────────────────────────────────────────────
eq([0, 1, 2, 3, 8, 47, 100].map(expectedPairs), [0, 0, 1, 3, 28, 1081, 4950], 'N(N-1)/2')
for (const n of [3, 8, 47]) {
  const ids = Array.from({ length: n }, (_, i) => `m${String(i).padStart(3, '0')}`)
  const pairs = enumeratePairs([...ids].reverse().concat(ids)) // shuffled + duplicated input
  eq(pairs.length, expectedPairs(n), `${n} members → ${expectedPairs(n)} pairs (dupes ignored)`)
  eq(new Set(pairs.map((p) => p.join('|'))).size, pairs.length, `${n}: pairs distinct`)
  ok(pairs.every(([a, b]) => a < b), `${n}: every pair canonical (a < b)`)
}
eq(canonicalPair('b', 'a'), ['a', 'b'], 'canonicalPair orders')
eq(populationHash(['b', 'a', 'a']), populationHash(['a', 'b']), 'population hash: order + dupes independent')
ok(populationHash(['a', 'b']) !== populationHash(['a', 'c']), 'population hash distinguishes populations')

// ── Coverage rejects everything but exact unique pairs of the current set ──────
const F = 'fin-current'
const pop = ['a', 'b', 'c']
const full = enumeratePairs(pop).map(([member_a, member_b]) => ({ member_a, member_b, finalization_id: F }))
eq(countCoverage(pop, full, F), { finalized_members: 3, expected_pairs: 3, completed_pairs: 3 }, 'full set complete')
ok(isComplete(countCoverage(pop, full, F)), 'full set isComplete')

const two = full.slice(0, 2)
const dup = [...two, two[0]]
eq(countCoverage(pop, dup, F).completed_pairs, 2, 'duplicate row does not count twice')
ok(!isComplete(countCoverage(pop, dup, F)), 'duplicates cannot fake completeness')

const mirror = [...two, { member_a: two[0].member_b, member_b: two[0].member_a, finalization_id: F }]
eq(countCoverage(pop, mirror, F).completed_pairs, 2, 'mirrored row does not count')
ok(!isComplete(countCoverage(pop, mirror, F)), 'mirror cannot fake completeness')

const outsider = [...two, { member_a: 'a', member_b: 'z', finalization_id: F }]
eq(countCoverage(pop, outsider, F).completed_pairs, 2, 'out-of-population row does not count')
ok(!isComplete(countCoverage(pop, outsider, F)), 'outsider cannot fake completeness')

const stale = [...two, { ...full[2], finalization_id: 'fin-old' }]
eq(countCoverage(pop, stale, F).completed_pairs, 2, 'row from a prior finalization does not count')
ok(!isComplete(countCoverage(pop, stale, F)), 'stale row cannot fake completeness')

const self = [...two, { member_a: 'c', member_b: 'c', finalization_id: F }]
eq(countCoverage(pop, self, F).completed_pairs, 2, 'self-pair does not count')

eq(countCoverage(pop, full, null).completed_pairs, 0, 'no current finalization → nothing counts')
eq(countCoverage([], [], F), { finalized_members: 0, expected_pairs: 0, completed_pairs: 0 }, 'empty population')

report('goose bands + pairs + coverage')
