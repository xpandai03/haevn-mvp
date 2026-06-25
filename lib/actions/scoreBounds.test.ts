/**
 * Guard regression test — the score band that keeps the 77–79 Recommendations
 * band out of "Your Matches".
 *
 * Run: npx tsx lib/actions/scoreBounds.test.ts
 */
import { scoreBounds, isMatchScore, isRecommendationScore } from '../matching/scoreBands'

let passed = 0
let failed = 0
function assert(label: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${label}`); passed++ }
  else { console.error(`  ✗ ${label}`); failed++ }
}

/** Mirror the in-query/in-loop predicate: a row is included iff min <= score <= max. */
function included(score: number, opts?: { minScore?: number; maxScore?: number }) {
  const { min, max } = scoreBounds(opts)
  return score >= min && score <= max
}

console.log('\n=== SCORE GUARD (Matches default >= 80) ===\n')

// Matches default band = [80, ∞): nothing below 80 may appear.
assert('default min is 80', scoreBounds().min === 80)
assert('default max is +Infinity', scoreBounds().max === Number.POSITIVE_INFINITY)
assert('Matches EXCLUDES 79 (band would-be leak)', included(79) === false)
assert('Matches EXCLUDES 77', included(77) === false)
assert('Matches INCLUDES exactly 80', included(80) === true)
assert('Matches INCLUDES 82', included(82) === true)
assert('Matches EXCLUDES 76', included(76) === false)

console.log('\n=== RECOMMENDATIONS band [77, 79] inclusive ===\n')

const REC = { minScore: 77, maxScore: 79 }
assert('Recs INCLUDE 77 (lower inclusive)', included(77, REC) === true)
assert('Recs INCLUDE 78', included(78, REC) === true)
assert('Recs INCLUDE 79 (upper inclusive)', included(79, REC) === true)
assert('Recs EXCLUDE exactly 80 (stays in Matches)', included(80, REC) === false)
assert('Recs EXCLUDE 76 (never stored/shown)', included(76, REC) === false)
assert('Recs EXCLUDE 85', included(85, REC) === false)

console.log('\n=== SHARED HELPERS (admin console + member readers) ===\n')

assert('isMatchScore(80) true', isMatchScore(80) === true)
assert('isMatchScore(79) false', isMatchScore(79) === false)
assert('isRecommendationScore(77) true', isRecommendationScore(77) === true)
assert('isRecommendationScore(79) true', isRecommendationScore(79) === true)
assert('isRecommendationScore(80) false', isRecommendationScore(80) === false)
assert('isRecommendationScore(76) false', isRecommendationScore(76) === false)
assert('match and recommendation are mutually exclusive at 80', isMatchScore(80) && !isRecommendationScore(80))

console.log(`\n${'='.repeat(50)}`)
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`)
console.log(`${'='.repeat(50)}\n`)
if (failed > 0) process.exit(1)
