/**
 * Match vs Recommendation band split. Run: npx tsx lib/metrics/__tests__/bands.test.ts
 * Source of truth: lib/matching/scoreBands.ts. getMetrics imports these same
 * constants, so this guards the weekly matches/recommendations boundary.
 */
import {
  MATCH_MIN_SCORE,
  REC_MIN_SCORE,
  REC_MAX_SCORE,
  isMatchScore,
  isRecommendationScore,
} from '../../matching/scoreBands'
import { eq, ok, report } from './_assert'

// Constants match the mockup's 77–79 recs / ≥80 matches — no discrepancy.
eq(MATCH_MIN_SCORE, 80, 'MATCH_MIN_SCORE = 80')
eq(REC_MIN_SCORE, 77, 'REC_MIN_SCORE = 77')
eq(REC_MAX_SCORE, 79, 'REC_MAX_SCORE = 79')

// Match boundary.
ok(isMatchScore(80), '80 is a match')
ok(!isMatchScore(79), '79 is NOT a match')
ok(isMatchScore(100), '100 is a match')

// Recommendation band [77, 79] inclusive.
ok(isRecommendationScore(77), '77 is a recommendation')
ok(isRecommendationScore(78), '78 is a recommendation')
ok(isRecommendationScore(79), '79 is a recommendation')
ok(!isRecommendationScore(80), '80 is NOT a recommendation (it is a match)')
ok(!isRecommendationScore(76), '76 is NOT a recommendation (below band)')

// No overlap: a score is never both.
for (let s = 70; s <= 90; s++) {
  ok(!(isMatchScore(s) && isRecommendationScore(s)), `${s} not both match and recommendation`)
}

report('bands')
