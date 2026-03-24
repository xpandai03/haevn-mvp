/**
 * Tests for 3 new survey questions (2026-03):
 * - Emotional Pace (Q_EMOTIONAL_PACE)
 * - Emotional Engagement (Q_EMOTIONAL_ENGAGEMENT)
 * - Independence Balance (Q_INDEPENDENCE_BALANCE)
 *
 * Run with: npx tsx lib/matching/new-questions.test.ts
 */

import { distanceScore } from './utils/scoring'
import { scoreConnection } from './categories/connection'
import { scoreLifestyle } from './categories/lifestyle'
import type { NormalizedAnswers } from './types'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${label}`)
  } else {
    failed++
    console.error(`  ❌ ${label}`)
  }
}

// =============================================================================
// 1. distanceScore() utility tests
// =============================================================================

console.log('\n🧪 distanceScore() — standard matrix')
assert(distanceScore('3', '3', 'standard') === 100, 'diff 0 → 100')
assert(distanceScore('2', '3', 'standard') === 85, 'diff 1 → 85')
assert(distanceScore('1', '3', 'standard') === 65, 'diff 2 → 65')
assert(distanceScore('1', '4', 'standard') === 40, 'diff 3 → 40')
assert(distanceScore('1', '5', 'standard') === 20, 'diff 4 → 20')

console.log('\n🧪 distanceScore() — engagement matrix')
assert(distanceScore('3', '3', 'engagement') === 100, 'diff 0 → 100')
assert(distanceScore('2', '3', 'engagement') === 85, 'diff 1 → 85')
assert(distanceScore('1', '3', 'engagement') === 60, 'diff 2 → 60')
assert(distanceScore('1', '4', 'engagement') === 35, 'diff 3 → 35')
assert(distanceScore('1', '5', 'engagement') === 15, 'diff 4 → 15')

console.log('\n🧪 distanceScore() — edge cases')
assert(distanceScore(undefined, '3', 'standard') === null, 'missing A → null')
assert(distanceScore('3', undefined, 'standard') === null, 'missing B → null')
assert(distanceScore(undefined, undefined, 'standard') === null, 'both missing → null')
assert(distanceScore('0', '3', 'standard') === null, 'out of range (0) → null')
assert(distanceScore('6', '3', 'standard') === null, 'out of range (6) → null')
assert(distanceScore('abc', '3', 'standard') === null, 'non-numeric → null')

// =============================================================================
// 2. Connection category with new sub-scorers
// =============================================================================

console.log('\n🧪 Connection category — new emotional sub-scorers')

// Base answers so other scorers have data to work with
const baseAnswers: NormalizedAnswers = {
  Q10: 'secure',
  Q10a: 'available',
  Q11: ['quality_time', 'words_of_affirmation'],
  Q12: 'collaborative',
  Q12a: 'moderate',
  Q37: 'high',
  Q37a: 'high',
  Q20: 'moderate',
  Q20b: 'selective',
}

// Test: both answered emotional pace
const userWithPace: NormalizedAnswers = { ...baseAnswers, Q_EMOTIONAL_PACE: '2' }
const matchWithPace: NormalizedAnswers = { ...baseAnswers, Q_EMOTIONAL_PACE: '3' }
const connectionResult1 = scoreConnection(userWithPace, matchWithPace)
const paceScore = connectionResult1.subScores.find(s => s.key === 'emotionalPace')
assert(paceScore !== undefined, 'emotionalPace appears in subScores')
assert(paceScore!.matched === true, 'emotionalPace matched when both answered')
assert(paceScore!.score === 85, 'emotionalPace diff 1 → 85')
assert(paceScore!.weight === 6, 'emotionalPace weight is 6')

// Test: both answered emotional engagement
const userWithEngagement: NormalizedAnswers = { ...baseAnswers, Q_EMOTIONAL_ENGAGEMENT: '4' }
const matchWithEngagement: NormalizedAnswers = { ...baseAnswers, Q_EMOTIONAL_ENGAGEMENT: '5' }
const connectionResult2 = scoreConnection(userWithEngagement, matchWithEngagement)
const engagementScore = connectionResult2.subScores.find(s => s.key === 'emotionalEngagement')
assert(engagementScore !== undefined, 'emotionalEngagement appears in subScores')
assert(engagementScore!.matched === true, 'emotionalEngagement matched when both answered')
assert(engagementScore!.score === 85, 'emotionalEngagement diff 1 → 85')
assert(engagementScore!.weight === 8, 'emotionalEngagement weight is 8')

// Test: missing answers → matched: false, excluded from scoring
const userNoNew: NormalizedAnswers = { ...baseAnswers }
const matchNoNew: NormalizedAnswers = { ...baseAnswers }
const connectionResult3 = scoreConnection(userNoNew, matchNoNew)
const paceNotMatched = connectionResult3.subScores.find(s => s.key === 'emotionalPace')
const engNotMatched = connectionResult3.subScores.find(s => s.key === 'emotionalEngagement')
assert(paceNotMatched!.matched === false, 'emotionalPace unmatched when missing')
assert(engNotMatched!.matched === false, 'emotionalEngagement unmatched when missing')

// Test: one answered, other didn't → excluded
const userOnlyPace: NormalizedAnswers = { ...baseAnswers, Q_EMOTIONAL_PACE: '3' }
const matchNoPace: NormalizedAnswers = { ...baseAnswers }
const connectionResult4 = scoreConnection(userOnlyPace, matchNoPace)
const pacePartial = connectionResult4.subScores.find(s => s.key === 'emotionalPace')
assert(pacePartial!.matched === false, 'emotionalPace unmatched when only one answered')

// =============================================================================
// 3. Lifestyle category with independence balance
// =============================================================================

console.log('\n🧪 Lifestyle category — independence balance sub-scorer')

const baseLifestyle: NormalizedAnswers = {
  Q19a: 'same_city',
  Q20: 'moderate',
  Q36: 'ambivert',
  Q18: 'social_drinker',
  Q13a: ['english'],
}

// Test: both answered independence
const userWithIndep: NormalizedAnswers = { ...baseLifestyle, Q_INDEPENDENCE_BALANCE: '3' }
const matchWithIndep: NormalizedAnswers = { ...baseLifestyle, Q_INDEPENDENCE_BALANCE: '2' }
const lifestyleResult1 = scoreLifestyle(userWithIndep, matchWithIndep)
const indepScore = lifestyleResult1.subScores.find(s => s.key === 'independenceBalance')
assert(indepScore !== undefined, 'independenceBalance appears in subScores')
assert(indepScore!.matched === true, 'independenceBalance matched when both answered')
assert(indepScore!.score === 85, 'independenceBalance diff 1 → 85')
assert(indepScore!.weight === 6, 'independenceBalance weight is 6')

// Test: large diff
const userFarIndep: NormalizedAnswers = { ...baseLifestyle, Q_INDEPENDENCE_BALANCE: '1' }
const matchFarIndep: NormalizedAnswers = { ...baseLifestyle, Q_INDEPENDENCE_BALANCE: '5' }
const lifestyleResult2 = scoreLifestyle(userFarIndep, matchFarIndep)
const indepFar = lifestyleResult2.subScores.find(s => s.key === 'independenceBalance')
assert(indepFar!.score === 20, 'independenceBalance diff 4 → 20')

// Test: missing → excluded
const userNoIndep: NormalizedAnswers = { ...baseLifestyle }
const matchNoIndep: NormalizedAnswers = { ...baseLifestyle }
const lifestyleResult3 = scoreLifestyle(userNoIndep, matchNoIndep)
const indepMissing = lifestyleResult3.subScores.find(s => s.key === 'independenceBalance')
assert(indepMissing!.matched === false, 'independenceBalance unmatched when missing')

// =============================================================================
// 4. Verify no gates affected
// =============================================================================

console.log('\n🧪 Verify new questions do NOT block matches')
// Even with max difference (score=20), category score is still positive
const userExtreme: NormalizedAnswers = {
  ...baseAnswers,
  Q_EMOTIONAL_PACE: '1',
  Q_EMOTIONAL_ENGAGEMENT: '1',
}
const matchExtreme: NormalizedAnswers = {
  ...baseAnswers,
  Q_EMOTIONAL_PACE: '5',
  Q_EMOTIONAL_ENGAGEMENT: '5',
}
const connectionExtreme = scoreConnection(userExtreme, matchExtreme)
assert(connectionExtreme.score > 0, 'Connection score > 0 even with max emotional diff')
assert(connectionExtreme.included === true, 'Connection category still included')

// =============================================================================
// 5. PDF spec example verification
// =============================================================================

console.log('\n🧪 PDF spec example: User A (2,4,3) vs User B (3,5,2)')
const specUserA: NormalizedAnswers = {
  ...baseAnswers,
  ...baseLifestyle,
  Q_EMOTIONAL_PACE: '2',
  Q_EMOTIONAL_ENGAGEMENT: '4',
  Q_INDEPENDENCE_BALANCE: '3',
}
const specUserB: NormalizedAnswers = {
  ...baseAnswers,
  ...baseLifestyle,
  Q_EMOTIONAL_PACE: '3',
  Q_EMOTIONAL_ENGAGEMENT: '5',
  Q_INDEPENDENCE_BALANCE: '2',
}
const specConnection = scoreConnection(specUserA, specUserB)
const specPace = specConnection.subScores.find(s => s.key === 'emotionalPace')
const specEngagement = specConnection.subScores.find(s => s.key === 'emotionalEngagement')
assert(specPace!.score === 85, 'Pace: diff 1 → 85')
assert(specEngagement!.score === 85, 'Engagement: diff 1 → 85')

const specLifestyle = scoreLifestyle(specUserA, specUserB)
const specIndep = specLifestyle.subScores.find(s => s.key === 'independenceBalance')
assert(specIndep!.score === 85, 'Independence: diff 1 → 85')

// =============================================================================
// RESULTS
// =============================================================================

console.log(`\n${'='.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('❌ SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('✅ ALL TESTS PASSED')
}
