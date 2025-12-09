/**
 * External Match Tests
 *
 * Test suite for external matching using the NEW 5-category engine.
 * Run with: npx tsx lib/matching/externalMatchTests.ts
 */

import {
  calculateCompatibility,
  normalizeAnswers,
  type RawAnswers,
  type CompatibilityResult,
  type CompatibilityTier,
} from './index'

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface TestCase {
  name: string
  partnershipA: {
    answers: RawAnswers
    profileType: 'solo' | 'couple' | 'pod'
  }
  partnershipB: {
    answers: RawAnswers
    profileType: 'solo' | 'couple' | 'pod'
  }
  expectedTier?: CompatibilityTier
  expectedMinScore?: number
  expectedMaxScore?: number
  shouldBlock?: boolean
}

function runTest(test: TestCase): { passed: boolean; result: CompatibilityResult; message: string } {
  const aIsCouple = test.partnershipA.profileType === 'couple'
  const bIsCouple = test.partnershipB.profileType === 'couple'

  const result = calculateCompatibility({
    partnerA: {
      partnershipId: 'test-a',
      userId: 'user-a',
      answers: normalizeAnswers(test.partnershipA.answers),
      isCouple: aIsCouple,
    },
    partnerB: {
      partnershipId: 'test-b',
      userId: 'user-b',
      answers: normalizeAnswers(test.partnershipB.answers),
      isCouple: bIsCouple,
    },
  })

  let passed = true
  let message = ''

  // Check blocking
  if (test.shouldBlock !== undefined) {
    if (test.shouldBlock && result.constraints.passed) {
      passed = false
      message = `Expected match to be BLOCKED but constraints passed`
    } else if (!test.shouldBlock && !result.constraints.passed) {
      passed = false
      message = `Expected match to PASS but was blocked: ${result.constraints.reason}`
    }
  }

  // Check tier
  if (test.expectedTier && result.tier !== test.expectedTier) {
    passed = false
    message += ` | Expected tier ${test.expectedTier}, got ${result.tier}`
  }

  // Check min score
  if (test.expectedMinScore !== undefined && result.overallScore < test.expectedMinScore) {
    passed = false
    message += ` | Expected score >= ${test.expectedMinScore}, got ${result.overallScore}`
  }

  // Check max score
  if (test.expectedMaxScore !== undefined && result.overallScore > test.expectedMaxScore) {
    passed = false
    message += ` | Expected score <= ${test.expectedMaxScore}, got ${result.overallScore}`
  }

  if (passed) {
    message = `Score: ${result.overallScore}% (${result.tier})`
  }

  return { passed, result, message }
}

// =============================================================================
// TEST DATA: PARTNERSHIP PROFILES
// =============================================================================

// Partnership A: Solo woman seeking exploration
const partnershipA_solo: RawAnswers = {
  // Intent
  Q9: ['dating', 'exploration'],
  Q9a: ['casual', 'adventure'],
  Q6: ['open'],
  Q6b: ['individuals', 'couples'],
  Q7: 'flexible',
  Q8: 'T2',
  Q10: 'secure',
  Q10a: 'ready',
  Q15: 'weekly',
  Q16: ['evenings', 'weekends'],
  Q16a: 'somewhat_flexible',
  Q12a: 'moderate',
  Q20: 'discreet',
  Q20b: 'comfortable',
  Q21: ['dating', 'exploration'],

  // Structure
  Q3: ['straight', 'bi_curious'],
  Q3a: 'open',
  Q3b: '2',
  Q3c: ['1', '2', '3'],
  Q4: 'single',
  Q30: 'T2',
  Q30a: ['condoms', 'testing'],
  Q31: ['regular_testing', 'open_discussion'],
  Q26: ['receiver', 'switch'],
  Q28: [],

  // Connection
  Q11: ['quality_time', 'physical_touch', 'words'],
  Q12: 'discuss',
  Q37: 'high',
  Q37a: 'value_harmony',
  Q38: 'low',
  Q38a: 'calm',

  // Chemistry
  Q23: ['sensual', 'playful'],
  Q24: ['cuddling', 'kissing', 'oral'],
  Q25: 'important',
  Q25a: 'weekly',
  Q27: ['fit', 'average'],
  Q33: ['light_bondage', 'roleplay'],
  Q33a: 'moderate',
  Q34: 'open',
  Q34a: 'moderate',
  Q29: ['anal', 'group'],

  // Lifestyle
  Q19a: 'local',
  Q19b: 'car',
  Q19c: 'willing',
  Q36: 'ambivert',
  Q36a: 'small_groups',
  Q18: 'social',
  Q13: 'important',
  Q13a: ['english'],
  Q14a: 'moderate',
  Q14b: 'progressive',
  Q17: 'no_kids',
}

// Partnership B: Solo man seeking connection
const partnershipB_solo: RawAnswers = {
  // Intent - Similar goals
  Q9: ['dating', 'connection'],
  Q9a: ['meaningful', 'adventure'],
  Q6: ['open'],
  Q6b: ['individuals'],
  Q7: 'flexible',
  Q8: 'T2',
  Q10: 'secure',
  Q10a: 'ready',
  Q15: 'weekly',
  Q16: ['evenings', 'weekends'],
  Q16a: 'flexible',
  Q12a: 'moderate',
  Q20: 'discreet',
  Q20b: 'comfortable',
  Q21: ['dating', 'connection'],

  // Structure - Compatible
  Q3: ['straight'],
  Q3a: 'open',
  Q3b: '1',
  Q3c: ['1', '2', '3'],
  Q4: 'single',
  Q30: 'T2',
  Q30a: ['condoms', 'testing'],
  Q31: ['regular_testing', 'honest'],
  Q26: ['giver', 'switch'],
  Q28: [],

  // Connection - Strong alignment
  Q11: ['physical_touch', 'quality_time', 'acts'],
  Q12: 'discuss',
  Q37: 'high',
  Q37a: 'value_harmony',
  Q38: 'low',
  Q38a: 'calm',

  // Chemistry - Good compatibility
  Q23: ['sensual', 'passionate'],
  Q24: ['cuddling', 'kissing', 'oral'],
  Q25: 'important',
  Q25a: 'weekly',
  Q27: ['fit', 'curvy'],
  Q33: ['light_bondage', 'sensory'],
  Q33a: 'moderate',
  Q34: 'open',
  Q34a: 'moderate',
  Q29: ['anal'],

  // Lifestyle - Compatible
  Q19a: 'local',
  Q19b: 'car',
  Q19c: 'willing',
  Q36: 'ambivert',
  Q36a: 'small_groups',
  Q18: 'social',
  Q13: 'important',
  Q13a: ['english'],
  Q14a: 'moderate',
  Q14b: 'progressive',
  Q17: 'no_kids',
}

// Partnership C: Couple seeking thirds (modified to be compatible)
const partnershipC_couple: RawAnswers = {
  // Intent - Different goals
  Q9: ['play', 'threesome'],
  Q9a: ['casual', 'fun'],
  Q6: ['poly', 'open'],
  Q6b: ['individuals', 'couples'], // Open to both
  Q6c: ['together_only', 'same_room'],
  Q6d: 'united',
  Q7: 'flexible',
  Q8: 'T3',
  Q10: 'secure',
  Q10a: 'cautious',
  Q15: 'monthly',
  Q16: ['weekends'],
  Q16a: 'somewhat_flexible',
  Q12a: 'moderate',
  Q20: 'discreet',
  Q20b: 'comfortable',
  Q21: ['play'],

  // Structure
  Q3: ['bi_curious'],
  Q3a: 'exploring',
  Q3b: '3',
  Q3c: ['2', '3', '4'],
  Q4: 'partnered',
  Q30: 'T3',
  Q30a: ['condoms', 'testing', 'barriers'],
  Q31: ['regular_testing'],
  Q26: ['both', 'switch'],
  Q28: [], // No hard boundaries

  // Connection
  Q11: ['physical_touch', 'quality_time'],
  Q12: 'discuss',
  Q37: 'moderate',
  Q37a: 'value_harmony',
  Q38: 'low',
  Q38a: 'calm',

  // Chemistry
  Q23: ['kinky', 'playful'],
  Q24: ['kissing', 'oral', 'group'],
  Q25: 'very_important',
  Q25a: 'multiple_weekly',
  Q27: ['any'],
  Q33: ['light_bondage', 'exhibitionism'],
  Q33a: 'experienced',
  Q34: 'very_open',
  Q34a: 'high',
  Q29: [],

  // Lifestyle
  Q19a: 'local',
  Q19b: 'car',
  Q19c: 'willing',
  Q36: 'extrovert',
  Q36a: 'parties',
  Q18: 'social',
  Q13: 'moderate',
  Q13a: ['english'],
  Q14a: 'flexible',
  Q14b: 'moderate',
  Q17: 'has_kids',
}

// Partnership D: With language requirement that will block
const partnershipD_blocking: RawAnswers = {
  ...partnershipA_solo,
  Q13a: ['spanish'],
  Q13a_required: true, // Requires Spanish
}

// Partnership E: With hard boundary conflict
const partnershipE_boundary: RawAnswers = {
  ...partnershipB_solo,
  Q28: ['oral', 'kissing'], // Hard nos that conflict
}

// =============================================================================
// TEST CASES
// =============================================================================

const testCases: TestCase[] = [
  // Test 1: Two compatible solos - should be high match
  {
    name: 'Compatible Solo-Solo Match',
    partnershipA: { answers: partnershipA_solo, profileType: 'solo' },
    partnershipB: { answers: partnershipB_solo, profileType: 'solo' },
    expectedMinScore: 60,
    shouldBlock: false,
  },

  // Test 2: Solo and Couple - moderate match
  {
    name: 'Solo-Couple Match',
    partnershipA: { answers: partnershipA_solo, profileType: 'solo' },
    partnershipB: { answers: partnershipC_couple, profileType: 'couple' },
    shouldBlock: false,
  },

  // Test 3: Language barrier should block
  {
    name: 'Language Barrier Block',
    partnershipA: { answers: partnershipD_blocking, profileType: 'solo' },
    partnershipB: { answers: partnershipB_solo, profileType: 'solo' },
    shouldBlock: true,
  },

  // Test 4: Hard boundary conflict should block
  {
    name: 'Hard Boundary Conflict Block',
    partnershipA: { answers: partnershipA_solo, profileType: 'solo' },
    partnershipB: { answers: partnershipE_boundary, profileType: 'solo' },
    shouldBlock: true,
  },

  // Test 5: Self-match - should be very high
  {
    name: 'Self-Match (Same Profile)',
    partnershipA: { answers: partnershipA_solo, profileType: 'solo' },
    partnershipB: { answers: partnershipA_solo, profileType: 'solo' },
    expectedMinScore: 85,
    expectedTier: 'Platinum',
    shouldBlock: false,
  },

  // Test 6: Couple-Couple match
  {
    name: 'Couple-Couple Match',
    partnershipA: { answers: partnershipC_couple, profileType: 'couple' },
    partnershipB: { answers: partnershipC_couple, profileType: 'couple' },
    expectedMinScore: 70,
    shouldBlock: false,
  },
]

// =============================================================================
// RUN TESTS
// =============================================================================

function runAllTests() {
  console.log('\n' + '='.repeat(70))
  console.log('EXTERNAL MATCHING ENGINE - TEST SUITE')
  console.log('='.repeat(70) + '\n')

  let passed = 0
  let failed = 0

  for (const test of testCases) {
    const { passed: testPassed, result, message } = runTest(test)

    const status = testPassed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
    console.log(`[${status}] ${test.name}`)
    console.log(`       ${message}`)

    // Print category breakdown for debugging
    if (!testPassed || process.argv.includes('--verbose')) {
      console.log('       Categories:')
      for (const cat of result.categories) {
        if (cat.included) {
          console.log(`         - ${cat.category}: ${Math.round(cat.score)}% (coverage: ${Math.round(cat.coverage * 100)}%)`)
        }
      }
      if (!result.constraints.passed) {
        console.log(`       BLOCKED: ${result.constraints.reason}`)
      }
    }
    console.log('')

    if (testPassed) passed++
    else failed++
  }

  console.log('='.repeat(70))
  console.log(`RESULTS: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(70) + '\n')

  return failed === 0
}

// Run tests
const success = runAllTests()
process.exit(success ? 0 : 1)
