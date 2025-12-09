/**
 * HAEVN Matching Engine - Development Test Harness
 *
 * Tests the matching engine with hardcoded test data to verify
 * all 5 categories: Intent, Structure, Connection, Chemistry, Lifestyle
 *
 * Run with: npx tsx lib/matching/devTest.ts
 */

import { calculateCompatibility } from './calculateCompatibility'
import type { NormalizedAnswers, CompatibilityInput, CompatibilityResult, CategoryScore } from './types'

// =============================================================================
// TEST DATA: TEST 1 - HIGHLY COMPATIBLE PAIR (Full coverage)
// =============================================================================

/**
 * User A: Open-minded poly person seeking connection
 */
const highCompatUser: NormalizedAnswers = {
  // Intent Fit
  Q9: ['long_term_connection', 'friendship', 'romantic'],
  Q9a: ['emotional_intimacy', 'companionship'],
  Q6: ['polyamorous', 'relationship_anarchy'],
  Q6b: ['solo', 'couples'],
  Q7: 'open',
  Q8: 'flexible',
  Q10: 'secure',
  Q10a: 'available',
  Q15: 'flexible',
  Q16: ['weekends', 'evenings'],
  Q16a: 'flexible',
  Q20: 'moderate',
  Q20b: 'selective',
  Q21: ['find_connections', 'explore_enm'],

  // Structure Fit
  Q3: ['bisexual', 'queer'],
  Q3b: '3',
  Q3c: ['2', '3', '4'],
  Q4: 'partnered',
  Q30: 'usually',
  Q30a: ['regular_testing', 'barrier_methods'],
  Q31: ['open_communication'],
  Q26: ['switch', 'versatile'],
  Q28: ['no_consent_violations'],

  // Connection Style
  Q11: ['quality_time', 'physical_touch', 'words_of_affirmation'],
  Q12: 'collaborative',
  Q12a: 'moderate',
  Q37: 'high',
  Q37a: 'high',
  Q38: 'low',
  Q38a: 'moderate',

  // Sexual Chemistry
  Q23: ['sensual', 'passionate'],
  Q24: ['cuddling', 'kissing'],
  Q25: 'very_important',
  Q25a: 'weekly',
  Q33: ['light_bdsm'],
  Q33a: 'intermediate',

  // Lifestyle
  Q13a: ['english', 'spanish'],
  Q19a: 'within_30_miles',
  Q36: 'ambivert',
  Q18: 'social_drinker',
}

/**
 * User B: Very similar preferences - should score high
 */
const highCompatMatch: NormalizedAnswers = {
  // Intent Fit - Very aligned
  Q9: ['long_term_connection', 'romantic', 'casual'],
  Q9a: ['emotional_intimacy', 'adventures'],
  Q6: ['polyamorous', 'open_relationship'],
  Q6b: ['solo', 'couples'],
  Q7: 'flexible',
  Q8: 'open',
  Q10: 'secure',
  Q10a: 'very_available',
  Q15: 'moderate',
  Q16: ['weekends', 'evenings', 'afternoons'],
  Q16a: 'moderate',
  Q20: 'moderate',
  Q20b: 'selective',
  Q21: ['find_connections', 'build_community'],

  // Structure Fit - Very aligned
  Q3: ['pansexual', 'queer'],
  Q3b: '3',
  Q3c: ['1', '2', '3', '4', '5'],
  Q4: 'partnered',
  Q30: 'usually',
  Q30a: ['regular_testing', 'barrier_methods', 'prep'],
  Q31: ['open_communication'],
  Q26: ['switch'],
  Q28: ['no_consent_violations', 'no_drugs'],

  // Connection Style - Very aligned
  Q11: ['quality_time', 'acts_of_service', 'physical_touch'],
  Q12: 'collaborative',
  Q12a: 'moderate',
  Q37: 'very_high',
  Q37a: 'high',
  Q38: 'low',
  Q38a: 'low',

  // Sexual Chemistry
  Q23: ['sensual', 'playful'],
  Q24: ['cuddling', 'massage'],
  Q25: 'important',
  Q25a: 'weekly',
  Q33: ['light_bdsm', 'roleplay'],
  Q33a: 'intermediate',

  // Lifestyle
  Q13a: ['english', 'french'],
  Q19a: 'within_30_miles',
  Q36: 'ambivert',
  Q18: 'social_drinker',
}

// =============================================================================
// TEST DATA: TEST 2 - POORLY COMPATIBLE PAIR
// =============================================================================

/**
 * User C: Seeking casual, very private
 */
const lowCompatUser: NormalizedAnswers = {
  // Intent Fit - Different goals
  Q9: ['casual', 'hookups'],
  Q9a: ['physical_intimacy'],
  Q6: ['swinging'],
  Q6b: ['couples'],
  Q7: 'monogamous',
  Q8: 'mostly_exclusive',
  Q10: 'avoidant',
  Q10a: 'limited',
  Q15: 'very_limited',
  Q16: ['late_nights'],
  Q16a: 'very_limited',
  Q20: 'very_private',
  Q20b: 'completely_hidden',
  Q21: ['hookups_only'],

  // Structure Fit - Different orientation/roles
  Q3: ['heterosexual'],
  Q3b: '1',
  Q3c: ['0', '1'],
  Q4: 'married',
  Q30: 'rarely',
  Q30a: [],
  Q31: [],
  Q26: ['dominant', 'top'],
  Q28: ['no_same_sex'],

  // Connection Style - Avoidant patterns
  Q11: ['gifts'],
  Q12: 'avoidant',
  Q12a: 'very_slow',
  Q37: 'low',
  Q37a: 'low',
  Q38: 'high',
  Q38a: 'high',

  // Sexual Chemistry
  Q23: ['dominant'],
  Q24: ['penetration_only'],
  Q25: 'essential',
  Q25a: 'daily',
  Q33: ['heavy_bdsm'],
  Q33a: 'expert',

  // Lifestyle
  Q13a: ['english'],
  Q19a: 'same_city',
  Q36: 'introvert',
  Q18: 'never',
}

/**
 * User D: Seeking deep connection, very open
 */
const lowCompatMatch: NormalizedAnswers = {
  // Intent Fit - Different goals
  Q9: ['long_term_connection', 'cohabitation'],
  Q9a: ['build_life_together', 'emotional_support'],
  Q6: ['relationship_anarchy'],
  Q6b: ['solo'],
  Q7: 'fully_open',
  Q8: 'fully_open',
  Q10: 'anxious',
  Q10a: 'very_available',
  Q15: 'very_flexible',
  Q16: ['mornings', 'afternoons', 'evenings', 'weekends'],
  Q16a: 'very_flexible',
  Q20: 'very_open',
  Q20b: 'completely_visible',
  Q21: ['find_life_partner'],

  // Structure Fit - Different orientation/roles
  Q3: ['gay', 'queer'],
  Q3b: '6',
  Q3c: ['5', '6'],
  Q4: 'single',
  Q30: 'always',
  Q30a: ['regular_testing', 'barrier_methods', 'prep', 'monkeypox_vaccine'],
  Q31: ['full_disclosure'],
  Q26: ['submissive', 'bottom'],
  Q28: ['no_women'],

  // Connection Style - Anxious patterns
  Q11: ['words_of_affirmation', 'physical_touch', 'quality_time'],
  Q12: 'confrontational',
  Q12a: 'very_quick',
  Q37: 'very_high',
  Q37a: 'very_high',
  Q38: 'very_high',
  Q38a: 'very_high',

  // Sexual Chemistry
  Q23: ['submissive', 'sensual'],
  Q24: ['cuddling', 'intimacy'],
  Q25: 'somewhat_important',
  Q25a: 'monthly',
  Q33: ['vanilla'],
  Q33a: 'beginner',

  // Lifestyle
  Q13a: ['english', 'mandarin'],
  Q19a: 'willing_to_relocate',
  Q36: 'extrovert',
  Q18: 'cannabis_friendly',
}

// =============================================================================
// TEST DATA: TEST 3 - HARD-FAIL PAIR (Constraint Violations)
// =============================================================================

/**
 * User E: Requires Spanish language
 */
const hardFailUser: NormalizedAnswers = {
  Q9: ['friendship'],
  Q6: ['polyamorous'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q13a: ['spanish'],
  Q13a_required: true, // LANGUAGE REQUIRED FLAG
  Q20: 'moderate',

  // Add some desires that will conflict
  Q33: ['group_sex', 'public'],
  Q23: ['exhibitionism'],
}

/**
 * User F: Only speaks Japanese, has hard boundary against group/public
 */
const hardFailMatch: NormalizedAnswers = {
  Q9: ['friendship'],
  Q6: ['polyamorous'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q13a: ['japanese', 'english'], // No Spanish!
  Q20: 'moderate',

  // Hard boundaries that conflict with User E's desires
  Q28: ['group', 'public', 'exhibitionism'],
}

// =============================================================================
// TEST DATA: TEST 4 - CHEMISTRY-HEAVY ALIGNMENT
// =============================================================================

/**
 * User G: High erotic alignment, kink-positive
 */
const chemistryUserG: NormalizedAnswers = {
  // Minimal Intent (just enough to not block)
  Q9: ['casual', 'fwb'],
  Q6: ['open_relationship'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q20: 'moderate',

  // Minimal Structure
  Q3: ['bisexual'],
  Q3b: '3',
  Q4: 'single',
  Q26: ['switch', 'versatile'],

  // Minimal Connection
  Q11: ['physical_touch'],
  Q12: 'collaborative',

  // HEAVY Chemistry emphasis
  Q23: ['passionate', 'sensual', 'playful', 'adventurous'],
  Q24: ['cuddling', 'kissing', 'massage', 'oral', 'toys'],
  Q25: 'essential',
  Q25a: 'few_times_week',
  Q33: ['light_bdsm', 'roleplay', 'bondage', 'sensation_play'],
  Q33a: 'experienced',
  Q34: 'very_open',
  Q29: ['new_experiences', 'fantasy_sharing'],
  Q28: ['scat', 'blood'],

  // Minimal Lifestyle
  Q13a: ['english'],
  Q18: 'social_drinker',
}

/**
 * User H: Also high erotic alignment - should have Chemistry > 80
 */
const chemistryUserH: NormalizedAnswers = {
  // Minimal Intent
  Q9: ['casual', 'fwb'],
  Q6: ['open_relationship'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q20: 'moderate',

  // Minimal Structure
  Q3: ['pansexual'],
  Q3b: '3',
  Q4: 'single',
  Q26: ['switch'],

  // Minimal Connection
  Q11: ['physical_touch'],
  Q12: 'collaborative',

  // HEAVY Chemistry - Very aligned with User G
  Q23: ['passionate', 'sensual', 'playful', 'kinky'],
  Q24: ['cuddling', 'kissing', 'massage', 'oral'],
  Q25: 'essential',
  Q25a: 'few_times_week',
  Q33: ['light_bdsm', 'roleplay', 'bondage', 'power_exchange'],
  Q33a: 'advanced',
  Q34: 'extremely_open',
  Q29: ['new_experiences', 'fantasy_sharing', 'boundaries'],
  Q28: ['scat', 'blood', 'minors'],

  // Minimal Lifestyle
  Q13a: ['english'],
  Q18: 'social_drinker',
}

// =============================================================================
// TEST DATA: TEST 5 - LIFESTYLE PARTIAL COVERAGE (Should exclude lifestyle)
// =============================================================================

/**
 * User I: Very few lifestyle answers
 */
const partialLifestyleUserI: NormalizedAnswers = {
  // Full Intent
  Q9: ['long_term_connection'],
  Q6: ['polyamorous'],
  Q6b: ['solo', 'couples'],
  Q10: 'secure',
  Q20: 'moderate',
  Q21: ['find_connections'],

  // Full Structure
  Q3: ['bisexual'],
  Q3b: '3',
  Q4: 'partnered',
  Q26: ['switch'],
  Q30: 'usually',

  // Full Connection
  Q11: ['quality_time', 'physical_touch'],
  Q12: 'collaborative',
  Q37: 'high',
  Q38: 'low',

  // Full Chemistry
  Q23: ['sensual'],
  Q24: ['cuddling'],
  Q25: 'important',
  Q25a: 'weekly',
  Q33: ['vanilla'],
  Q33a: 'intermediate',

  // MINIMAL Lifestyle - Only languages (10% weight)
  Q13a: ['english'],
  // No Q19a, Q36, Q18, Q13, Q14a, Q14b, Q17, Q17a, Q17b
}

/**
 * User J: Also very few lifestyle answers
 */
const partialLifestyleUserJ: NormalizedAnswers = {
  // Full Intent
  Q9: ['long_term_connection'],
  Q6: ['polyamorous'],
  Q6b: ['solo', 'couples'],
  Q10: 'secure',
  Q20: 'moderate',
  Q21: ['find_connections'],

  // Full Structure
  Q3: ['pansexual'],
  Q3b: '3',
  Q4: 'partnered',
  Q26: ['switch'],
  Q30: 'usually',

  // Full Connection
  Q11: ['quality_time', 'physical_touch'],
  Q12: 'collaborative',
  Q37: 'high',
  Q38: 'low',

  // Full Chemistry
  Q23: ['sensual'],
  Q24: ['cuddling'],
  Q25: 'important',
  Q25a: 'weekly',
  Q33: ['vanilla'],
  Q33a: 'intermediate',

  // MINIMAL Lifestyle - Only languages (10% weight)
  Q13a: ['english'],
  // No other lifestyle answers
}

// =============================================================================
// TEST RUNNER FUNCTIONS
// =============================================================================

function formatSubScores(subScores: CategoryScore['subScores']): string {
  if (subScores.length === 0) return '    (no sub-scores)'
  return subScores
    .map(s => `    - ${s.key}: ${s.score} (weight: ${s.weight}, matched: ${s.matched})${s.reason ? ` - "${s.reason}"` : ''}`)
    .join('\n')
}

function formatCategoryScores(categories: CategoryScore[]): string {
  return categories
    .map(c => {
      return `  ${c.category.toUpperCase()} (weight: ${c.weight}, included: ${c.included}):
    Score: ${c.score}
    Coverage: ${(c.coverage * 100).toFixed(1)}%
    Sub-scores:
${formatSubScores(c.subScores)}`
    })
    .join('\n\n')
}

function formatNormalizedWeights(weights: Record<string, number>): string {
  const entries = Object.entries(weights)
    .map(([k, v]) => `${k}: ${v.toFixed(2)}%`)
    .join(', ')
  return `{ ${entries} }`
}

function formatResult(result: CompatibilityResult, label: string): void {
  console.log('\n' + '='.repeat(80))
  console.log(`TEST: ${label}`)
  console.log('='.repeat(80))

  console.log('\n--- CONSTRAINTS ---')
  console.log(`Passed: ${result.constraints.passed}`)
  if (!result.constraints.passed) {
    console.log(`Blocked By: ${result.constraints.blockedBy}`)
    console.log(`Reason: ${result.constraints.reason}`)
  }

  console.log('\n--- OVERALL SCORE ---')
  console.log(`Score: ${result.overallScore}`)
  console.log(`Tier: ${result.tier}`)
  console.log(`Lifestyle Included: ${result.lifestyleIncluded}`)

  console.log('\n--- WEIGHTS ---')
  console.log('Raw Weights:', result.rawWeights)
  console.log('Normalized Weights:', formatNormalizedWeights(result.normalizedWeights))

  // Check if weights sum to 100 (or 0 if blocked)
  const weightSum = Object.values(result.normalizedWeights).reduce((a, b) => a + b, 0)
  console.log(`Weight Sum: ${weightSum.toFixed(2)}% (should be 100% or 0% if blocked)`)

  console.log('\n--- CATEGORY BREAKDOWN ---')
  console.log(formatCategoryScores(result.categories))

  console.log('\n')
}

function runTests(): void {
  console.log('\n')
  console.log('*'.repeat(80))
  console.log('*  HAEVN MATCHING ENGINE - COMPREHENSIVE TEST HARNESS')
  console.log('*  Testing all 5 categories: Intent, Structure, Connection, Chemistry, Lifestyle')
  console.log('*'.repeat(80))

  // ==========================================================================
  // Test 1: Highly Compatible Pair (Full Coverage)
  // ==========================================================================
  const test1Input: CompatibilityInput = {
    partnerA: {
      partnershipId: 'test-1a',
      userId: 'user-a',
      answers: highCompatUser,
      isCouple: false,
    },
    partnerB: {
      partnershipId: 'test-1b',
      userId: 'user-b',
      answers: highCompatMatch,
      isCouple: false,
    },
  }
  const test1Result = calculateCompatibility(test1Input)
  formatResult(test1Result, 'TEST 1: HIGHLY COMPATIBLE PAIR (Expected: Gold/Platinum, all categories scoring)')

  // ==========================================================================
  // Test 2: Poorly Compatible Pair (Blocked by mutual_interest)
  // ==========================================================================
  const test2Input: CompatibilityInput = {
    partnerA: {
      partnershipId: 'test-2a',
      userId: 'user-c',
      answers: lowCompatUser,
      isCouple: true, // User C is a couple
    },
    partnerB: {
      partnershipId: 'test-2b',
      userId: 'user-d',
      answers: lowCompatMatch,
      isCouple: false,
    },
  }
  const test2Result = calculateCompatibility(test2Input)
  formatResult(test2Result, 'TEST 2: POORLY COMPATIBLE PAIR (Expected: Blocked by mutual_interest)')

  // ==========================================================================
  // Test 3: Hard-Fail Pair (Language Constraint)
  // ==========================================================================
  const test3Input: CompatibilityInput = {
    partnerA: {
      partnershipId: 'test-3a',
      userId: 'user-e',
      answers: hardFailUser,
      isCouple: false,
    },
    partnerB: {
      partnershipId: 'test-3b',
      userId: 'user-f',
      answers: hardFailMatch,
      isCouple: false,
    },
  }
  const test3Result = calculateCompatibility(test3Input)
  formatResult(test3Result, 'TEST 3: HARD-FAIL PAIR (Expected: Blocked by language constraint)')

  // ==========================================================================
  // Test 4: Chemistry-Heavy Alignment
  // ==========================================================================
  const test4Input: CompatibilityInput = {
    partnerA: {
      partnershipId: 'test-4a',
      userId: 'user-g',
      answers: chemistryUserG,
      isCouple: false,
    },
    partnerB: {
      partnershipId: 'test-4b',
      userId: 'user-h',
      answers: chemistryUserH,
      isCouple: false,
    },
  }
  const test4Result = calculateCompatibility(test4Input)
  formatResult(test4Result, 'TEST 4: CHEMISTRY-HEAVY ALIGNMENT (Expected: Chemistry > 80)')

  // ==========================================================================
  // Test 5: Lifestyle Partial Coverage (Should exclude lifestyle)
  // ==========================================================================
  const test5Input: CompatibilityInput = {
    partnerA: {
      partnershipId: 'test-5a',
      userId: 'user-i',
      answers: partialLifestyleUserI,
      isCouple: false,
    },
    partnerB: {
      partnershipId: 'test-5b',
      userId: 'user-j',
      answers: partialLifestyleUserJ,
      isCouple: false,
    },
  }
  const test5Result = calculateCompatibility(test5Input)
  formatResult(test5Result, 'TEST 5: LIFESTYLE PARTIAL COVERAGE (Expected: Lifestyle excluded, weights renormalized)')

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  // Get chemistry score from test 4
  const test4Chemistry = test4Result.categories.find(c => c.category === 'chemistry')?.score || 0

  // Get lifestyle category from test 5
  const test5Lifestyle = test5Result.categories.find(c => c.category === 'lifestyle')
  const test5LifestyleIncluded = test5Lifestyle?.included || false
  const test5LifestyleCoverage = test5Lifestyle?.coverage || 0

  console.log(`
Test 1 - High Compat:     Score=${test1Result.overallScore}, Tier=${test1Result.tier}, Lifestyle=${test1Result.lifestyleIncluded ? 'INCLUDED' : 'EXCLUDED'}
Test 2 - Low Compat:      Score=${test2Result.overallScore}, Tier=${test2Result.tier}, Blocked=${test2Result.constraints.blockedBy || 'N/A'}
Test 3 - Hard Fail:       Score=${test3Result.overallScore}, Tier=${test3Result.tier}, Blocked=${test3Result.constraints.blockedBy || 'N/A'}
Test 4 - Chemistry Focus: Score=${test4Result.overallScore}, Tier=${test4Result.tier}, Chemistry=${test4Chemistry}
Test 5 - Partial Life:    Score=${test5Result.overallScore}, Tier=${test5Result.tier}, Lifestyle=${test5LifestyleIncluded ? 'INCLUDED' : 'EXCLUDED'} (${(test5LifestyleCoverage * 100).toFixed(1)}% coverage)
`)

  // ==========================================================================
  // Validation Checks
  // ==========================================================================
  console.log('--- VALIDATION CHECKS ---')
  const issues: string[] = []

  // Test 1 checks
  if (test1Result.overallScore < 70) {
    issues.push('Test 1: High compat pair scored too low (expected >= 70)')
  }
  if (!test1Result.lifestyleIncluded) {
    issues.push('Test 1: Lifestyle should be included (has enough coverage)')
  }

  // Test 2 checks
  if (test2Result.constraints.passed) {
    issues.push('Test 2: Should have been blocked by mutual_interest constraint')
  }

  // Test 3 checks
  if (test3Result.constraints.passed) {
    issues.push('Test 3: Should have been blocked by language constraint')
  }
  if (test3Result.constraints.blockedBy !== 'language') {
    issues.push(`Test 3: Expected blocked by 'language', got '${test3Result.constraints.blockedBy}'`)
  }

  // Test 4 checks - Chemistry focus
  if (test4Chemistry < 80) {
    issues.push(`Test 4: Chemistry score too low (${test4Chemistry}, expected >= 80)`)
  }
  if (!test4Result.constraints.passed) {
    issues.push('Test 4: Should NOT be blocked by constraints')
  }

  // Test 5 checks - Lifestyle exclusion
  if (test5LifestyleIncluded) {
    issues.push(`Test 5: Lifestyle should be EXCLUDED (coverage ${(test5LifestyleCoverage * 100).toFixed(1)}% < 40% threshold)`)
  }

  // Check weight renormalization for Test 5
  const test5WeightSum = Object.values(test5Result.normalizedWeights).reduce((a, b) => a + b, 0)
  if (Math.abs(test5WeightSum - 100) > 0.1 && test5Result.constraints.passed) {
    issues.push(`Test 5: Normalized weights should sum to 100%, got ${test5WeightSum.toFixed(2)}%`)
  }
  if (test5Result.normalizedWeights.lifestyle !== 0 && !test5LifestyleIncluded) {
    issues.push('Test 5: Lifestyle weight should be 0 when excluded')
  }

  // Print results
  if (issues.length === 0) {
    console.log('\n  *** ALL VALIDATIONS PASSED! ***\n')
  } else {
    console.log('\n  ISSUES FOUND:')
    issues.forEach(i => console.log(`    - ${i}`))
    console.log('')
  }

  // Print weight renormalization check
  console.log('--- WEIGHT RENORMALIZATION CHECK (Test 5) ---')
  console.log(`Lifestyle included: ${test5LifestyleIncluded}`)
  console.log(`Lifestyle coverage: ${(test5LifestyleCoverage * 100).toFixed(1)}%`)
  console.log(`Threshold: 40%`)
  console.log(`Normalized weights: ${formatNormalizedWeights(test5Result.normalizedWeights)}`)
  console.log(`Sum: ${test5WeightSum.toFixed(2)}%`)

  if (!test5LifestyleIncluded) {
    console.log('\n  Expected renormalized weights (lifestyle excluded):')
    console.log('  Intent: 30/90 * 100 = 33.33%')
    console.log('  Structure: 25/90 * 100 = 27.78%')
    console.log('  Connection: 20/90 * 100 = 22.22%')
    console.log('  Chemistry: 15/90 * 100 = 16.67%')
    console.log('  Lifestyle: 0%')
  }

  console.log('\n')
}

// CLI entry point
if (require.main === module) {
  runTests()
}

export { runTests }
