/**
 * HAEVN Matching Engine - Demo Test Cases
 *
 * Run with: npx tsx lib/matching/demoTests.ts
 *
 * This file contains 6 realistic partner pair scenarios to demonstrate
 * the matching engine's behavior across different compatibility situations.
 *
 * ============================================================================
 * TEST SCENARIOS:
 * ============================================================================
 *
 * 1. HIGHLY COMPATIBLE COUPLE
 *    - Sarah & Marcus: Long-term ENM couple with aligned goals, great communication,
 *      and complementary roles. Expected: Platinum tier (85+)
 *
 * 2. MIXED-SIGNAL COUPLE
 *    - Alex & Jordan: Some alignment but different attachment styles, mismatched
 *      frequency expectations, different social energy. Expected: Silver tier (55-69)
 *
 * 3. CLEARLY INCOMPATIBLE COUPLE
 *    - Casey & Morgan: Fundamental mismatches in goals (casual vs. serious),
 *      conflicting boundaries, different relationship styles. Expected: Bronze tier (<55)
 *
 * 4. CONSTRAINT-BLOCKED PAIR (Language)
 *    - Li Wei & Sofia: Would be compatible but require language match and share
 *      no common languages. Expected: Blocked by language constraint
 *
 * 5. LIFESTYLE-HEAVY PAIR
 *    - Emma & Noah: Strong lifestyle alignment (same city, social energy, substances,
 *      cultural values) but minimal other answers. Tests lifestyle coverage threshold.
 *
 * 6. CHEMISTRY-HEAVY PAIR
 *    - Kai & River: Exceptional sexual chemistry (kinks, roles, frequency aligned)
 *      with moderate scores elsewhere. Expected: High chemistry score (85+)
 *
 * ============================================================================
 */

import { calculateCompatibility } from './calculateCompatibility'
import { normalizeAnswers } from './utils/normalizeAnswers'
import type { NormalizedAnswers, CompatibilityResult, CategoryScore } from './types'

// =============================================================================
// TEST DATA: HIGHLY COMPATIBLE COUPLE (Sarah & Marcus)
// =============================================================================

const sarahAnswers: NormalizedAnswers = {
  // Intent
  Q9: ['long_term_relationship', 'emotional_connection', 'physical_intimacy'],
  Q9a: ['build_deeper_bond', 'explore_together'],
  Q6: ['polyamory', 'open_relationship'],
  Q6b: ['solo', 'couple'],
  Q7: 'emotionally_exclusive',
  Q8: 'primary_partner',
  Q10: 'secure',
  Q10a: 'fully_available',
  Q15: 'multiple_per_week',
  Q16: ['weekday_evenings', 'weekends'],
  Q16a: 'very_flexible',
  Q12a: 'daily',
  Q20: 'moderate',
  Q20b: 'comfortable',
  Q21: ['meet_new_partners', 'deepen_existing'],

  // Structure
  Q3: ['bisexual', 'queer'],
  Q3a: 'ethically_non_monogamous',
  Q3b: '3',
  Q3c: ['2', '3', '4'],
  Q4: 'partnered',
  Q30: 'moderate',
  Q30a: ['condoms_always', 'regular_testing'],
  Q31: ['quarterly_testing', 'open_communication'],
  Q26: ['switch', 'versatile'],
  Q28: ['no_consent_violation', 'no_drugs'],

  // Connection
  Q11: ['quality_time', 'physical_touch', 'words_of_affirmation'],
  Q12: 'collaborative',
  Q37: 'high',
  Q37a: 'high',
  Q38: 'low',
  Q38a: 'low',

  // Chemistry
  Q23: ['sensual', 'passionate', 'playful'],
  Q24: ['group_experiences', 'roleplay', 'light_bdsm'],
  Q25: 'very_important',
  Q25a: 'few_times_week',
  Q27: ['athletic', 'average'],
  Q33: ['light_bondage', 'roleplay', 'sensory_play'],
  Q33a: 'intermediate',
  Q34: 'very_open',
  Q34a: 'adventurous',
  Q29: ['boundaries', 'new_experiences'],

  // Lifestyle
  Q19a: 'same_city',
  Q19b: 'flexible',
  Q19c: 'willing',
  Q36: 'ambivert',
  Q36a: 'social_sometimes',
  Q18: 'social_only',
  Q13: 'somewhat_important',
  Q13a: ['english', 'spanish'],
  Q13a_required: false,
  Q14a: 'liberal',
  Q14b: 'progressive',
  Q17: 'no_kids',
  Q17a: ['vegetarian'],
  Q17b: 'has_pets',
}

const marcusAnswers: NormalizedAnswers = {
  // Intent - very aligned with Sarah
  Q9: ['long_term_relationship', 'emotional_connection', 'physical_intimacy'],
  Q9a: ['build_deeper_bond', 'explore_together', 'meet_new_people'],
  Q6: ['polyamory', 'open_relationship'],
  Q6b: ['solo', 'couple'],
  Q7: 'emotionally_exclusive',
  Q8: 'primary_partner',
  Q10: 'secure',
  Q10a: 'fully_available',
  Q15: 'multiple_per_week',
  Q16: ['weekday_evenings', 'weekends', 'spontaneous'],
  Q16a: 'flexible',
  Q12a: 'daily',
  Q20: 'moderate',
  Q20b: 'comfortable',
  Q21: ['meet_new_partners', 'deepen_existing'],

  // Structure - aligned
  Q3: ['bisexual', 'pansexual'],
  Q3a: 'ethically_non_monogamous',
  Q3b: '4',
  Q3c: ['2', '3', '4', '5'],
  Q4: 'partnered',
  Q30: 'moderate',
  Q30a: ['condoms_always', 'regular_testing', 'sti_disclosure'],
  Q31: ['quarterly_testing', 'open_communication'],
  Q26: ['switch', 'dominant'],
  Q28: ['no_consent_violation', 'no_drugs'],

  // Connection - great alignment
  Q11: ['quality_time', 'physical_touch', 'acts_of_service'],
  Q12: 'collaborative',
  Q37: 'high',
  Q37a: 'high',
  Q38: 'low',
  Q38a: 'moderate',

  // Chemistry - complementary
  Q23: ['sensual', 'passionate', 'dominant'],
  Q24: ['group_experiences', 'roleplay', 'light_bdsm', 'tantra'],
  Q25: 'very_important',
  Q25a: 'few_times_week',
  Q27: ['athletic', 'curvy'],
  Q33: ['light_bondage', 'roleplay', 'power_exchange'],
  Q33a: 'experienced',
  Q34: 'very_open',
  Q34a: 'adventurous',
  Q29: ['boundaries', 'new_experiences', 'safety'],

  // Lifestyle - aligned
  Q19a: 'same_city',
  Q19b: 'flexible',
  Q19c: 'willing',
  Q36: 'ambivert',
  Q36a: 'social_sometimes',
  Q18: 'social_only',
  Q13: 'somewhat_important',
  Q13a: ['english', 'french'],
  Q13a_required: false,
  Q14a: 'liberal',
  Q14b: 'progressive',
  Q17: 'no_kids',
  Q17a: ['omnivore'],
  Q17b: 'has_pets',
}

// =============================================================================
// TEST DATA: MIXED-SIGNAL COUPLE (Alex & Jordan)
// =============================================================================

const alexAnswers: NormalizedAnswers = {
  // Intent - some alignment
  Q9: ['casual_dating', 'physical_intimacy'],
  Q9a: ['explore_sexuality', 'have_fun'],
  Q6: ['open_relationship'],
  Q6b: ['solo'],
  Q7: 'non_exclusive',
  Q8: 'casual',
  Q10: 'anxious',  // Mismatch with Jordan's avoidant
  Q10a: 'somewhat_available',
  Q15: 'weekly',
  Q16: ['weekends'],
  Q16a: 'somewhat_flexible',
  Q12a: 'multiple_daily',  // Wants lots of texting
  Q20: 'private',
  Q20b: 'cautious',
  Q21: ['meet_new_partners'],

  // Structure
  Q3: ['heterosexual'],
  Q3a: 'ethically_non_monogamous',
  Q3b: '1',
  Q3c: ['0', '1', '2'],
  Q4: 'single',
  Q30: 'strict',
  Q30a: ['condoms_always', 'regular_testing'],
  Q31: ['monthly_testing'],
  Q26: ['submissive'],
  Q28: ['no_face_slapping'],

  // Connection - mismatches
  Q11: ['words_of_affirmation', 'quality_time'],
  Q12: 'accommodating',
  Q37: 'very_high',
  Q37a: 'very_high',
  Q38: 'high',  // High jealousy
  Q38a: 'high',

  // Chemistry
  Q23: ['romantic', 'sensual'],
  Q24: ['vanilla', 'sensual_massage'],
  Q25: 'important',
  Q25a: 'weekly',
  Q27: ['athletic'],
  Q33: ['none'],
  Q33a: 'beginner',
  Q34: 'somewhat_hesitant',
  Q34a: 'cautious',
  Q29: ['boundaries'],

  // Lifestyle - differences
  Q19a: 'same_city',
  Q19b: 'limited',
  Q19c: 'reluctant',
  Q36: 'introvert',  // Very different from Jordan
  Q36a: 'prefer_alone',
  Q18: 'never',
  Q13a: ['english'],
  Q13a_required: false,
}

const jordanAnswers: NormalizedAnswers = {
  // Intent - partial overlap
  Q9: ['casual_dating', 'friendship', 'networking'],
  Q9a: ['meet_new_people', 'have_fun'],
  Q6: ['open_relationship', 'swinging'],
  Q6b: ['solo', 'couple'],
  Q7: 'non_exclusive',
  Q8: 'casual',
  Q10: 'avoidant',  // Mismatch - challenging pairing
  Q10a: 'limited_availability',
  Q15: 'monthly',  // Much less time
  Q16: ['weekends', 'spontaneous'],
  Q16a: 'rigid',
  Q12a: 'few_times_week',  // Less texting than Alex wants
  Q20: 'open',
  Q20b: 'very_comfortable',
  Q21: ['networking', 'events'],

  // Structure
  Q3: ['heterosexual', 'heteroflexible'],
  Q3a: 'ethically_non_monogamous',
  Q3b: '2',
  Q3c: ['1', '2', '3'],
  Q4: 'single',
  Q30: 'moderate',
  Q30a: ['condoms_usually'],
  Q31: ['occasional_testing'],
  Q26: ['dominant', 'switch'],
  Q28: ['no_scat'],

  // Connection
  Q11: ['acts_of_service', 'gifts'],  // Different love languages
  Q12: 'avoidant',
  Q37: 'moderate',
  Q37a: 'moderate',
  Q38: 'low',
  Q38a: 'low',

  // Chemistry - some overlap
  Q23: ['playful', 'adventurous'],
  Q24: ['group_experiences', 'exhibitionism'],
  Q25: 'somewhat_important',
  Q25a: 'monthly',  // Big frequency mismatch
  Q27: ['average', 'curvy'],
  Q33: ['exhibitionism', 'voyeurism'],
  Q33a: 'intermediate',
  Q34: 'open',
  Q34a: 'adventurous',
  Q29: ['new_experiences'],

  // Lifestyle
  Q19a: 'same_region',
  Q19b: 'flexible',
  Q19c: 'willing',
  Q36: 'extrovert',  // Mismatch
  Q36a: 'very_social',
  Q18: 'regular',
  Q13a: ['english'],
  Q13a_required: false,
}

// =============================================================================
// TEST DATA: CLEARLY INCOMPATIBLE COUPLE (Casey & Morgan)
// =============================================================================

const caseyAnswers: NormalizedAnswers = {
  // Intent - fundamental mismatch
  Q9: ['serious_relationship', 'marriage_potential'],
  Q9a: ['find_life_partner', 'start_family'],
  Q6: ['monogamy_curious'],  // Wants monogamy
  Q6b: ['solo'],
  Q7: 'fully_exclusive',
  Q8: 'exclusive',
  Q10: 'secure',
  Q10a: 'fully_available',
  Q15: 'daily',
  Q16: ['weekday_evenings', 'weekends', 'mornings'],
  Q16a: 'very_flexible',
  Q12a: 'daily',
  Q20: 'very_private',
  Q20b: 'uncomfortable',
  Q21: ['find_partner'],

  // Structure - incompatible
  Q3: ['heterosexual'],
  Q3a: 'monogamous',
  Q3b: '0',
  Q3c: ['0', '1'],
  Q4: 'single',
  Q30: 'very_strict',
  Q30a: ['condoms_always', 'prep', 'full_panel'],
  Q31: ['monthly_testing', 'full_disclosure'],
  Q26: ['vanilla'],
  Q28: ['no_group', 'no_bdsm', 'no_anal'],  // Many boundaries

  // Connection
  Q11: ['quality_time', 'words_of_affirmation'],
  Q12: 'collaborative',
  Q37: 'high',
  Q37a: 'high',
  Q38: 'moderate',
  Q38a: 'moderate',

  // Chemistry - vanilla
  Q23: ['romantic', 'gentle'],
  Q24: ['vanilla', 'sensual'],
  Q25: 'moderately_important',
  Q25a: 'few_times_month',
  Q27: ['average'],
  Q33: ['none'],
  Q33a: 'none',
  Q34: 'not_open',
  Q34a: 'traditional',
  Q29: [],

  // Lifestyle
  Q19a: 'same_city',
  Q19b: 'limited',
  Q19c: 'reluctant',
  Q36: 'introvert',
  Q36a: 'prefer_alone',
  Q18: 'never',
  Q13a: ['english'],
  Q13a_required: false,
  Q17: 'wants_kids',
  Q17b: 'no_pets',
}

const morganAnswers: NormalizedAnswers = {
  // Intent - opposite of Casey
  Q9: ['casual_fun', 'hookups', 'physical_intimacy'],
  Q9a: ['no_strings', 'variety'],
  Q6: ['relationship_anarchy', 'polyamory'],
  Q6b: ['solo', 'couple', 'group'],
  Q7: 'non_exclusive',
  Q8: 'no_hierarchy',
  Q10: 'avoidant',
  Q10a: 'limited_availability',
  Q15: 'few_times_month',
  Q16: ['late_nights', 'spontaneous'],
  Q16a: 'rigid',
  Q12a: 'rarely',
  Q20: 'open',
  Q20b: 'very_comfortable',
  Q21: ['events', 'parties'],

  // Structure - incompatible
  Q3: ['pansexual', 'queer'],
  Q3a: 'relationship_anarchist',
  Q3b: '5',
  Q3c: ['3', '4', '5', '6'],
  Q4: 'its_complicated',
  Q30: 'relaxed',
  Q30a: ['fluid_bonded_with_some'],
  Q31: ['occasional_testing'],
  Q26: ['dominant', 'sadist'],
  Q28: [],  // No boundaries (might conflict with Casey's many)

  // Connection
  Q11: ['physical_touch', 'gifts'],
  Q12: 'competitive',
  Q37: 'low',
  Q37a: 'low',
  Q38: 'very_low',
  Q38a: 'very_low',

  // Chemistry - very different from Casey
  Q23: ['dominant', 'edgy', 'primal'],
  Q24: ['bdsm', 'group', 'public'],
  Q25: 'essential',
  Q25a: 'multiple_daily',
  Q27: ['any'],
  Q33: ['heavy_bondage', 'impact_play', 'edge_play'],
  Q33a: 'expert',
  Q34: 'extremely_open',
  Q34a: 'extreme',
  Q29: ['everything_on_table'],

  // Lifestyle
  Q19a: 'anywhere',
  Q19b: 'very_flexible',
  Q19c: 'enthusiastic',
  Q36: 'extrovert',
  Q36a: 'very_social',
  Q18: 'regular',
  Q13a: ['english', 'german'],
  Q13a_required: false,
  Q17: 'no_kids_ever',
  Q17b: 'no_pets',
}

// =============================================================================
// TEST DATA: CONSTRAINT-BLOCKED PAIR - Language (Li Wei & Sofia)
// =============================================================================

const liWeiAnswers: NormalizedAnswers = {
  // Good compatibility answers - but language will block
  Q9: ['long_term_relationship', 'emotional_connection'],
  Q9a: ['build_deeper_bond'],
  Q6: ['polyamory'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q10a: 'fully_available',
  Q20: 'moderate',
  Q20b: 'comfortable',

  // Requires language match!
  Q13a: ['mandarin', 'cantonese'],
  Q13a_required: true,  // This is the key - requires language match

  Q3: ['bisexual'],
  Q4: 'partnered',
  Q30: 'moderate',
  Q26: ['switch'],
  Q11: ['quality_time'],
  Q12: 'collaborative',
  Q23: ['sensual'],
  Q25: 'important',
  Q25a: 'weekly',
}

const sofiaAnswers: NormalizedAnswers = {
  // Good compatibility answers
  Q9: ['long_term_relationship', 'emotional_connection'],
  Q9a: ['build_deeper_bond'],
  Q6: ['polyamory'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q10a: 'fully_available',
  Q20: 'moderate',
  Q20b: 'comfortable',

  // No overlap with Li Wei's languages
  Q13a: ['spanish', 'portuguese', 'italian'],
  Q13a_required: true,

  Q3: ['bisexual'],
  Q4: 'partnered',
  Q30: 'moderate',
  Q26: ['switch'],
  Q11: ['quality_time'],
  Q12: 'collaborative',
  Q23: ['sensual'],
  Q25: 'important',
  Q25a: 'weekly',
}

// =============================================================================
// TEST DATA: LIFESTYLE-HEAVY PAIR (Emma & Noah)
// =============================================================================

const emmaAnswers: NormalizedAnswers = {
  // Minimal intent/structure/connection/chemistry answers
  Q9: ['casual_dating'],
  Q6: ['open_relationship'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q20: 'moderate',
  Q3: ['heterosexual'],
  Q4: 'single',
  Q11: ['quality_time'],
  Q23: ['sensual'],
  Q25: 'important',

  // HEAVY LIFESTYLE DATA - all 10 sub-components answered
  Q19a: 'same_city',
  Q19b: 'flexible',
  Q19c: 'willing',
  Q36: 'ambivert',
  Q36a: 'social_sometimes',
  Q18: 'social_only',
  Q13: 'very_important',
  Q13a: ['english', 'french'],
  Q13a_required: false,
  Q14a: 'liberal',
  Q14b: 'progressive',
  Q17: 'no_kids',
  Q17a: ['vegan'],
  Q17b: 'has_pets',
}

const noahAnswers: NormalizedAnswers = {
  // Minimal other answers
  Q9: ['casual_dating'],
  Q6: ['open_relationship'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q20: 'moderate',
  Q3: ['heterosexual'],
  Q4: 'single',
  Q11: ['physical_touch'],  // Different love language
  Q23: ['playful'],
  Q25: 'somewhat_important',

  // MATCHING LIFESTYLE DATA
  Q19a: 'same_city',
  Q19b: 'flexible',
  Q19c: 'willing',
  Q36: 'ambivert',
  Q36a: 'social_sometimes',
  Q18: 'social_only',
  Q13: 'very_important',
  Q13a: ['english', 'spanish'],
  Q13a_required: false,
  Q14a: 'liberal',
  Q14b: 'progressive',
  Q17: 'no_kids',
  Q17a: ['vegetarian'],
  Q17b: 'has_pets',
}

// =============================================================================
// TEST DATA: CHEMISTRY-HEAVY PAIR (Kai & River)
// =============================================================================

const kaiAnswers: NormalizedAnswers = {
  // Moderate intent/structure
  Q9: ['physical_intimacy', 'casual_dating'],
  Q6: ['open_relationship'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q10a: 'somewhat_available',
  Q20: 'moderate',
  Q3: ['pansexual'],
  Q4: 'single',
  Q30: 'moderate',

  // Moderate connection
  Q11: ['physical_touch'],
  Q12: 'direct',
  Q37: 'moderate',
  Q38: 'low',

  // EXCEPTIONAL CHEMISTRY - comprehensive and aligned
  Q23: ['passionate', 'dominant', 'primal', 'sensual'],
  Q24: ['bdsm', 'roleplay', 'power_exchange', 'impact_play', 'bondage'],
  Q25: 'essential',
  Q25a: 'few_times_week',
  Q27: ['athletic', 'slim', 'average'],
  Q33: ['bondage', 'impact_play', 'power_exchange', 'sensory_deprivation', 'roleplay'],
  Q33a: 'experienced',
  Q34: 'very_open',
  Q34a: 'adventurous',
  Q29: ['safety', 'aftercare', 'new_dynamics'],
  Q26: ['dominant', 'switch'],
  Q28: ['no_scat', 'no_blood'],

  // Minimal lifestyle
  Q13a: ['english'],
}

const riverAnswers: NormalizedAnswers = {
  // Moderate intent/structure
  Q9: ['physical_intimacy', 'casual_dating'],
  Q6: ['open_relationship'],
  Q6b: ['solo'],
  Q10: 'secure',
  Q10a: 'somewhat_available',
  Q20: 'moderate',
  Q3: ['bisexual'],
  Q4: 'single',
  Q30: 'moderate',

  // Moderate connection
  Q11: ['physical_touch', 'acts_of_service'],
  Q12: 'collaborative',
  Q37: 'high',
  Q38: 'low',

  // MATCHING EXCEPTIONAL CHEMISTRY - complementary roles
  Q23: ['passionate', 'submissive', 'sensual', 'playful'],
  Q24: ['bdsm', 'roleplay', 'power_exchange', 'bondage', 'sensory_play'],
  Q25: 'essential',
  Q25a: 'few_times_week',
  Q27: ['athletic', 'slim'],
  Q33: ['bondage', 'impact_play', 'power_exchange', 'sensory_deprivation', 'service'],
  Q33a: 'experienced',
  Q34: 'very_open',
  Q34a: 'adventurous',
  Q29: ['safety', 'aftercare', 'boundaries'],
  Q26: ['submissive', 'switch'],  // Complementary to Kai
  Q28: ['no_scat', 'no_blood'],

  // Minimal lifestyle
  Q13a: ['english'],
}

// =============================================================================
// OUTPUT HELPERS
// =============================================================================

function printSeparator(char = '=', length = 80) {
  console.log(char.repeat(length))
}

function printHeader(title: string) {
  printSeparator()
  console.log(`TEST: ${title}`)
  printSeparator()
}

function printCategoryBreakdown(categories: CategoryScore[]) {
  for (const cat of categories) {
    const includedTag = cat.included ? 'INCLUDED' : 'EXCLUDED'
    console.log(`\n  ${cat.category.toUpperCase()} (weight: ${cat.weight}, ${includedTag}):`)
    console.log(`    Score: ${Math.round(cat.score)}`)
    console.log(`    Coverage: ${(cat.coverage * 100).toFixed(1)}%`)

    if (cat.subScores.length > 0) {
      console.log('    Sub-scores:')
      for (const sub of cat.subScores) {
        const matchedTag = sub.matched ? '' : ' [NO DATA]'
        console.log(`      - ${sub.key}: ${sub.score} (weight: ${sub.weight})${matchedTag}`)
        if (sub.reason) {
          console.log(`        "${sub.reason}"`)
        }
      }
    }
  }
}

function printResult(result: CompatibilityResult, partnerAName: string, partnerBName: string) {
  console.log(`\n--- ${partnerAName} & ${partnerBName} ---`)

  console.log('\n=== CONSTRAINTS ===')
  console.log(`Passed: ${result.constraints.passed}`)
  if (!result.constraints.passed) {
    console.log(`BLOCKED BY: ${result.constraints.blockedBy}`)
    console.log(`Reason: ${result.constraints.reason}`)
  }

  console.log('\n=== OVERALL RESULT ===')
  console.log(`Score: ${result.overallScore}`)
  console.log(`Tier: ${result.tier}`)
  console.log(`Lifestyle Included: ${result.lifestyleIncluded}`)

  console.log('\n=== WEIGHTS ===')
  console.log('Raw Weights:', result.rawWeights)

  const normalizedFormatted: Record<string, string> = {}
  for (const [key, value] of Object.entries(result.normalizedWeights)) {
    normalizedFormatted[key] = `${value.toFixed(2)}%`
  }
  console.log('Normalized Weights:', normalizedFormatted)

  const weightSum = Object.values(result.normalizedWeights).reduce((a, b) => a + b, 0)
  console.log(`Weight Sum: ${weightSum.toFixed(2)}%`)

  console.log('\n=== CATEGORY BREAKDOWN ===')
  printCategoryBreakdown(result.categories)
}

// =============================================================================
// RUN TESTS
// =============================================================================

function runTest(
  testNumber: number,
  title: string,
  description: string,
  partnerAName: string,
  partnerAAnswers: NormalizedAnswers,
  partnerAIsCouple: boolean,
  partnerBName: string,
  partnerBAnswers: NormalizedAnswers,
  partnerBIsCouple: boolean
) {
  printHeader(`${testNumber}. ${title}`)
  console.log(`\nDescription: ${description}\n`)

  const result = calculateCompatibility({
    partnerA: {
      partnershipId: `test-${testNumber}-a`,
      userId: `user-${partnerAName.toLowerCase()}`,
      answers: partnerAAnswers,
      isCouple: partnerAIsCouple,
    },
    partnerB: {
      partnershipId: `test-${testNumber}-b`,
      userId: `user-${partnerBName.toLowerCase()}`,
      answers: partnerBAnswers,
      isCouple: partnerBIsCouple,
    },
  })

  printResult(result, partnerAName, partnerBName)
  console.log('\n')

  return result
}

// =============================================================================
// MAIN
// =============================================================================

console.log('\n')
printSeparator('*')
console.log('*  HAEVN MATCHING ENGINE - DEMO TEST CASES')
console.log('*  Testing 6 realistic partner pair scenarios')
printSeparator('*')
console.log('\n')

// Test 1: Highly Compatible Couple
const test1 = runTest(
  1,
  'HIGHLY COMPATIBLE COUPLE',
  'Sarah & Marcus: Long-term ENM couple with aligned goals, great communication, complementary roles. Expected: Platinum tier (85+)',
  'Sarah', sarahAnswers, false,
  'Marcus', marcusAnswers, false
)

// Test 2: Mixed-Signal Couple
const test2 = runTest(
  2,
  'MIXED-SIGNAL COUPLE',
  'Alex & Jordan: Anxious-avoidant attachment pairing, mismatched frequency, different social energy. Expected: Silver tier (55-69)',
  'Alex', alexAnswers, false,
  'Jordan', jordanAnswers, false
)

// Test 3: Clearly Incompatible Couple
const test3 = runTest(
  3,
  'CLEARLY INCOMPATIBLE COUPLE',
  'Casey & Morgan: Monogamy vs relationship anarchy, vanilla vs BDSM expert, traditional vs extreme. Expected: Bronze tier (<55)',
  'Casey', caseyAnswers, false,
  'Morgan', morganAnswers, false
)

// Test 4: Constraint-Blocked Pair
const test4 = runTest(
  4,
  'CONSTRAINT-BLOCKED PAIR (Language)',
  'Li Wei & Sofia: Would be compatible but both require language match with no overlap. Expected: Blocked by language constraint',
  'Li Wei', liWeiAnswers, false,
  'Sofia', sofiaAnswers, false
)

// Test 5: Lifestyle-Heavy Pair
const test5 = runTest(
  5,
  'LIFESTYLE-HEAVY PAIR',
  'Emma & Noah: Strong lifestyle alignment with full coverage, minimal other answers. Tests lifestyle inclusion threshold.',
  'Emma', emmaAnswers, false,
  'Noah', noahAnswers, false
)

// Test 6: Chemistry-Heavy Pair
const test6 = runTest(
  6,
  'CHEMISTRY-HEAVY PAIR',
  'Kai & River: Exceptional sexual chemistry (kinks, complementary roles, frequency). Expected: Chemistry score 85+',
  'Kai', kaiAnswers, false,
  'River', riverAnswers, false
)

// =============================================================================
// SUMMARY
// =============================================================================

printSeparator('=')
console.log('SUMMARY')
printSeparator('=')

console.log(`
Test 1 - Highly Compatible:     Score=${test1.overallScore}, Tier=${test1.tier}
Test 2 - Mixed Signals:         Score=${test2.overallScore}, Tier=${test2.tier}
Test 3 - Clearly Incompatible:  Score=${test3.overallScore}, Tier=${test3.tier}
Test 4 - Language Blocked:      ${test4.constraints.passed ? `Score=${test4.overallScore}` : `BLOCKED by ${test4.constraints.blockedBy}`}
Test 5 - Lifestyle Heavy:       Score=${test5.overallScore}, Tier=${test5.tier}, Lifestyle=${test5.lifestyleIncluded ? 'INCLUDED' : 'EXCLUDED'}
Test 6 - Chemistry Heavy:       Score=${test6.overallScore}, Tier=${test6.tier}, Chemistry=${Math.round(test6.categories.find(c => c.category === 'chemistry')?.score || 0)}
`)

// Validation checks
console.log('--- VALIDATION CHECKS ---\n')

const validations = [
  { name: 'Test 1 should be Platinum or Gold', pass: test1.tier === 'Platinum' || test1.tier === 'Gold' },
  { name: 'Test 2 should be Silver or Bronze', pass: test2.tier === 'Silver' || test2.tier === 'Bronze' },
  { name: 'Test 3 should be Bronze', pass: test3.tier === 'Bronze' },
  { name: 'Test 4 should be blocked by language', pass: !test4.constraints.passed && test4.constraints.blockedBy === 'language' },
  { name: 'Test 5 lifestyle should be included (high coverage)', pass: test5.lifestyleIncluded === true },
  { name: 'Test 6 chemistry score should be >= 80', pass: (test6.categories.find(c => c.category === 'chemistry')?.score || 0) >= 80 },
]

let allPassed = true
for (const v of validations) {
  const status = v.pass ? 'PASS' : 'FAIL'
  console.log(`  [${status}] ${v.name}`)
  if (!v.pass) allPassed = false
}

console.log('')
if (allPassed) {
  console.log('  *** ALL VALIDATIONS PASSED! ***')
} else {
  console.log('  !!! SOME VALIDATIONS FAILED !!!')
}
console.log('')
