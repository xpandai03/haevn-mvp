/**
 * Test file for HAEVN scoring engine
 * Run with: npx ts-node lib/matching/scoring.test.ts
 */

import { calculateMatch, calculateMatches, UserProfile, MatchScore } from './scoring'

// ============================================================================
// TEST DATA
// ============================================================================

const userA: UserProfile = {
  id: 'user-a',
  identity: 'single',
  age: 32,
  seeking_targets: ['women', 'couples'],
  structure: 'ENM',
  intent: ['dating', 'play'],
  discretion_level: 'Medium',
  location: {
    city: 'San Francisco',
    state: 'CA',
    msa: 'SF-BAY-AREA'
  },
  is_verified: true,
  has_background_check: false
}

const userB: UserProfile = {
  id: 'user-b',
  identity: 'couple',
  age: 28,
  seeking_targets: ['men', 'women', 'couples'],
  structure: 'ENM',
  intent: ['play'],
  discretion_level: 'Medium',
  location: {
    city: 'San Francisco',
    state: 'CA',
    msa: 'SF-BAY-AREA'
  },
  is_verified: false,
  has_background_check: false
}

const userC: UserProfile = {
  id: 'user-c',
  identity: 'single',
  age: 35,
  seeking_targets: ['men'],
  structure: 'Monogamous',
  intent: ['dating', 'long-term'],
  discretion_level: 'High',
  location: {
    city: 'Los Angeles',
    state: 'CA',
    msa: 'LA-METRO'
  },
  is_verified: true,
  has_background_check: true
}

const userD: UserProfile = {
  id: 'user-d',
  identity: 'couple',
  age: 30,
  seeking_targets: ['couples', 'women'],
  structure: 'Open',
  intent: ['play', 'friendship'],
  discretion_level: 'Low',
  location: {
    city: 'Oakland',
    state: 'CA',
    msa: 'SF-BAY-AREA'
  },
  is_verified: true,
  has_background_check: false
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

function runTest(name: string, userX: UserProfile, userY: UserProfile, expectedTier?: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`TEST: ${name}`)
  console.log('='.repeat(60))

  const result = calculateMatch(userX, userY)

  console.log(`\n👤 User A: ${userX.identity} seeking ${userX.seeking_targets?.join(', ')}`)
  console.log(`👤 User B: ${userY.identity} seeking ${userY.seeking_targets?.join(', ')}`)
  console.log(`\n📊 SCORE: ${result.score}/100`)
  console.log(`🏆 TIER: ${result.tier}`)

  if (result.excluded) {
    console.log(`❌ EXCLUDED: ${result.exclusion_reason}`)
  }

  console.log('\n📈 Breakdown:')
  console.log(`  • Seeking/Identity: ${result.breakdown.seeking_identity.toFixed(1)} (25% weight)`)
  console.log(`  • Structure: ${result.breakdown.structure.toFixed(1)} (20% weight)`)
  console.log(`  • Intent: ${result.breakdown.intent.toFixed(1)} (20% weight)`)
  console.log(`  • Location: ${result.breakdown.location.toFixed(1)} (20% weight)`)
  console.log(`  • Discretion: ${result.breakdown.discretion.toFixed(1)} (10% weight)`)
  console.log(`  • Verification: ${result.breakdown.verification.toFixed(1)} (5% weight)`)

  if (expectedTier && result.tier !== expectedTier) {
    console.log(`\n⚠️  WARNING: Expected ${expectedTier}, got ${result.tier}`)
  } else if (expectedTier) {
    console.log(`\n✅ PASS: Got expected tier ${expectedTier}`)
  }

  return result
}

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('\n🧪 HAEVN SCORING ENGINE TESTS')
console.log('Based on HAEVN_MatchingSpec_v1.0_Final\n')

// Test 1: High Match (from spec example)
runTest(
  'High Match - User A seeks couples, User B is couple, same location/structure',
  userA,
  userB,
  'Platinum'
)

// Test 2: Low Match - Different structure and location
runTest(
  'Low Match - Different structure (ENM vs Monogamous) and location',
  userA,
  userC
)

// Test 3: Medium Match - Compatible but different discretion
runTest(
  'Medium/High Match - Compatible but different discretion levels',
  userA,
  userD
)

// Test 4: Excluded - Identity not in seeking
const userE: UserProfile = {
  ...userC,
  id: 'user-e',
  identity: 'single',
  seeking_targets: ['men'], // Only seeking men
}

runTest(
  'Excluded - Identity not in seeking preferences',
  userE,
  userB // userB is a couple
)

// Test 5: Calculate multiple matches
console.log(`\n${'='.repeat(60)}`)
console.log('TEST: Calculate Multiple Matches')
console.log('='.repeat(60))

const potentialMatches = [userB, userC, userD]
const matches = calculateMatches(userA, potentialMatches, 'Bronze')

console.log(`\n👤 User A seeking matches...`)
console.log(`\n📊 Found ${matches.length} matches:\n`)

matches.forEach((m, idx) => {
  console.log(`${idx + 1}. ${m.match.identity} (${m.match.id}): ${m.score.score} - ${m.score.tier}`)
})

console.log(`\n${'='.repeat(60)}`)
console.log('✅ ALL TESTS COMPLETE')
console.log('='.repeat(60))
