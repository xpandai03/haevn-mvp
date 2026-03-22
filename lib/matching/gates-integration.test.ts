/**
 * P0 Gate Integration Tests — Full Pipeline Validation
 *
 * Verifies that gates integrate correctly with the full matching pipeline:
 * - Failed gates stop scoring (score=0, no categories)
 * - Passed gates allow full scoring
 * - Edge cases handled gracefully
 *
 * Run with: npx tsx lib/matching/gates-integration.test.ts
 */

import type { RawAnswers } from './types'
import { calculateCompatibilityFromRaw } from './calculateCompatibility'
import {
  checkAgeRangeConstraint,
  checkDistanceConstraint,
  checkRaceConstraint,
} from './utils/constraints'

// =============================================================================
// TEST HELPERS
// =============================================================================

let passed = 0
let failed = 0

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

// Base raw answers with enough data for scoring to produce a real result
const BASE_USER_RAW: RawAnswers = {
  q1_age: '1994-06-15',
  q9_intentions: ['long_term', 'dating'],
  q6_relationship_styles: ['open', 'polyamory'],
  q6b_who_to_meet: ['solo_individuals'],
  q4_relationship_status: 'single',
  q10_attachment_style: 'secure',
  q10a_emotional_availability: 'available',
  q3_sexual_orientation: ['bisexual'],
  q3b_kinsey_scale: '3',
  q23_erotic_styles: ['sensual', 'adventurous'],
  q20_discretion: 'moderate',
  q25_chemistry_vs_emotion: 'important',
  q26_roles: ['switch'],
  q19a_max_distance: 'Within 50 miles',
}

const BASE_MATCH_RAW: RawAnswers = {
  q1_age: '1992-03-20',
  q9_intentions: ['long_term', 'fwb'],
  q6_relationship_styles: ['open', 'enm'],
  q6b_who_to_meet: ['solo_individuals'],
  q4_relationship_status: 'single',
  q10_attachment_style: 'secure',
  q10a_emotional_availability: 'available',
  q3_sexual_orientation: ['pansexual'],
  q3b_kinsey_scale: '4',
  q23_erotic_styles: ['sensual', 'romantic'],
  q20_discretion: 'moderate',
  q25_chemistry_vs_emotion: 'very_important',
  q26_roles: ['switch', 'bottom'],
  q19a_max_distance: 'Within 100 miles',
}

// =============================================================================
// STEP 2: AGE GATE — Full Pipeline Integration
// =============================================================================

console.log('\n=== STEP 2: AGE GATE INTEGRATION ===\n')

// Case A: Valid both directions
{
  const user: RawAnswers = { ...BASE_USER_RAW, q1_age: '1996-01-01', q_age_min: '25', q_age_max: '40' }
  const match: RawAnswers = { ...BASE_MATCH_RAW, q1_age: '1994-01-01', q_age_min: '20', q_age_max: '45' }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case A: Both ages in range → PASS, score > 0', result.constraints.passed && result.overallScore > 0)
}

// Case B: Match age outside User's range → FAIL
{
  const user: RawAnswers = { ...BASE_USER_RAW, q1_age: '1996-01-01', q_age_min: '25', q_age_max: '30' }
  const match: RawAnswers = { ...BASE_MATCH_RAW, q1_age: '1988-01-01', q_age_min: '20', q_age_max: '45' }
  // Match is ~38, User max is 30
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case B: Match age 38 outside User range 25-30 → FAIL', !result.constraints.passed)
  assert('  blockedBy=age_range', result.constraints.blockedBy === 'age_range')
  assert('  score=0', result.overallScore === 0)
  assert('  no categories scored', result.categories.every(c => c.score === 0 && !c.included))
}

// Case C: User age outside Match's range → FAIL
{
  const user: RawAnswers = { ...BASE_USER_RAW, q1_age: '1990-01-01', q_age_min: '20', q_age_max: '50' }
  const match: RawAnswers = { ...BASE_MATCH_RAW, q1_age: '1998-01-01', q_age_min: '22', q_age_max: '30' }
  // User is ~36, Match max is 30
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case C: User age 36 outside Match range 22-30 → FAIL', !result.constraints.passed)
  assert('  blockedBy=age_range', result.constraints.blockedBy === 'age_range')
}

// Case D: Missing age data → SKIP (pass through, allow scoring)
{
  const user: RawAnswers = { ...BASE_USER_RAW } // has q1_age but no q_age_min/max
  const match: RawAnswers = { ...BASE_MATCH_RAW }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case D: No age prefs set → PASS (skip), scoring proceeds', result.constraints.passed && result.overallScore > 0)
}

// Case D2: Missing age entirely
{
  const user: RawAnswers = { ...BASE_USER_RAW, q_age_min: '25', q_age_max: '35' }
  delete user.q1_age
  const match: RawAnswers = { ...BASE_MATCH_RAW }
  delete match.q1_age
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case D2: No ages at all → PASS (skip)', result.constraints.passed)
}

// =============================================================================
// STEP 3: DISTANCE GATE — Full Pipeline Integration
// =============================================================================

console.log('\n=== STEP 3: DISTANCE GATE INTEGRATION ===\n')

// Case A: Within both caps (SF to Oakland ~12mi)
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q19a_max_distance: 'Within 50 miles',
    _latitude: 37.7749, _longitude: -122.4194,
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q19a_max_distance: 'Within 25 miles',
    _latitude: 37.8044, _longitude: -122.2712,
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case A: SF→Oakland ~12mi, both caps ≥25mi → PASS', result.constraints.passed && result.overallScore > 0)
}

// Case B: Exceeds User's cap (SF to LA ~347mi)
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q19a_max_distance: 'Within 50 miles',
    _latitude: 37.7749, _longitude: -122.4194,
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q19a_max_distance: 'Any distance',
    _latitude: 34.0522, _longitude: -118.2437,
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case B: SF→LA ~347mi, User cap 50mi → FAIL', !result.constraints.passed)
  assert('  blockedBy=distance', result.constraints.blockedBy === 'distance')
  assert('  score=0', result.overallScore === 0)
}

// Case C: Exceeds Match's cap
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q19a_max_distance: 'Any distance',
    _latitude: 37.7749, _longitude: -122.4194,
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q19a_max_distance: 'Within 10 miles',
    _latitude: 37.3382, _longitude: -121.8863, // San Jose ~42mi
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case C: SF→SJ ~42mi, Match cap 10mi → FAIL', !result.constraints.passed)
  assert('  blockedBy=distance', result.constraints.blockedBy === 'distance')
}

// Case D: Missing coordinates → SKIP
{
  const user: RawAnswers = { ...BASE_USER_RAW, q19a_max_distance: 'Within 10 miles' }
  const match: RawAnswers = { ...BASE_MATCH_RAW, q19a_max_distance: 'Within 10 miles' }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case D: No coordinates → PASS (skip), scoring proceeds', result.constraints.passed && result.overallScore > 0)
}

// Case E: Both "Any distance" over long range
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q19a_max_distance: 'Any distance',
    _latitude: 40.7128, _longitude: -74.0060, // NYC
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q19a_max_distance: 'Any distance',
    _latitude: 34.0522, _longitude: -118.2437, // LA
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case E: NYC→LA ~2450mi, both "Any" → PASS', result.constraints.passed)
}

// =============================================================================
// STEP 4: RACE GATE — Full Pipeline Integration
// =============================================================================

console.log('\n=== STEP 4: RACE GATE INTEGRATION ===\n')

// Case A: "any" only → PASS
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q_race_identity: ['White / Caucasian'],
    q_race_preference: ['Any'],
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q_race_identity: ['Black / African American'],
    q_race_preference: ['Any'],
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case A: Both "Any" → PASS, scoring proceeds', result.constraints.passed && result.overallScore > 0)
}

// Case B: "any" + specifics → PASS (not a gate)
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q_race_identity: ['White / Caucasian'],
    q_race_preference: ['Any', 'Asian', 'Hispanic / Latino'],
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q_race_identity: ['Black / African American'],
    q_race_preference: ['Any'],
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case B: "Any"+specifics → PASS (preference only)', result.constraints.passed && result.overallScore > 0)
}

// Case C: Specifics only, compatible → PASS
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q_race_identity: ['Asian'],
    q_race_preference: ['Asian', 'White / Caucasian'],
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q_race_identity: ['White / Caucasian'],
    q_race_preference: ['Asian'],
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case C: Specifics only, compatible → PASS', result.constraints.passed && result.overallScore > 0)
}

// Case D: Specifics only, incompatible → FAIL
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q_race_identity: ['White / Caucasian'],
    q_race_preference: ['Asian'],
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q_race_identity: ['Black / African American'],
    q_race_preference: ['Any'],
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case D: User wants "Asian", Match is "Black" → FAIL', !result.constraints.passed)
  assert('  blockedBy=race', result.constraints.blockedBy === 'race')
  assert('  score=0', result.overallScore === 0)
  assert('  no categories scored', result.categories.every(c => c.score === 0 && !c.included))
}

// Case E: Bidirectional mismatch
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q_race_identity: ['Hispanic / Latino'],
    q_race_preference: ['Any'],
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q_race_identity: ['White / Caucasian'],
    q_race_preference: ['Asian', 'Black / African American'],
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Case E: Match excludes User → FAIL', !result.constraints.passed)
  assert('  blockedBy=race', result.constraints.blockedBy === 'race')
}

// =============================================================================
// STEP 5: INTEGRATION — Verify failed gates stop scoring entirely
// =============================================================================

console.log('\n=== STEP 5: FULL PIPELINE INTEGRATION ===\n')

// Verify a passing pair gets real scores
{
  const result = calculateCompatibilityFromRaw(BASE_USER_RAW, BASE_MATCH_RAW)
  assert('Passing pair: constraints.passed=true', result.constraints.passed === true)
  assert('Passing pair: overallScore > 0', result.overallScore > 0)
  assert('Passing pair: has category scores', result.categories.some(c => c.score > 0))
  assert('Passing pair: has tier', ['Platinum', 'Gold', 'Silver', 'Bronze'].includes(result.tier))
  console.log(`  → Score: ${result.overallScore}%, Tier: ${result.tier}`)
}

// Verify a failing pair gets zero everything
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q1_age: '1996-01-01',
    q_age_min: '25',
    q_age_max: '28',
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q1_age: '1980-01-01', // age ~46, way outside 25-28
    q_age_min: '40',
    q_age_max: '55',
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Blocked pair: constraints.passed=false', result.constraints.passed === false)
  assert('Blocked pair: overallScore=0', result.overallScore === 0)
  assert('Blocked pair: tier=Bronze', result.tier === 'Bronze')
  assert('Blocked pair: all categories score=0', result.categories.every(c => c.score === 0))
  assert('Blocked pair: all categories included=false', result.categories.every(c => !c.included))
  assert('Blocked pair: reason string present', typeof result.constraints.reason === 'string' && result.constraints.reason.length > 0)
  console.log(`  → Blocked by: ${result.constraints.blockedBy}, Reason: ${result.constraints.reason}`)
}

// Verify multiple gates: age passes but distance fails
{
  const user: RawAnswers = {
    ...BASE_USER_RAW,
    q1_age: '1996-01-01',
    q_age_min: '25',
    q_age_max: '40',
    q19a_max_distance: 'Within 10 miles',
    _latitude: 37.7749, _longitude: -122.4194, // SF
  }
  const match: RawAnswers = {
    ...BASE_MATCH_RAW,
    q1_age: '1994-01-01',
    q_age_min: '25',
    q_age_max: '40',
    q19a_max_distance: 'Any distance',
    _latitude: 34.0522, _longitude: -118.2437, // LA
  }
  const result = calculateCompatibilityFromRaw(user, match)
  assert('Age passes but distance fails → blocked by distance', result.constraints.blockedBy === 'distance')
}

// =============================================================================
// SUMMARY
// =============================================================================

console.log(`\n${'='.repeat(60)}`)
console.log(`INTEGRATION RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} total`)
console.log(`${'='.repeat(60)}\n`)

if (failed > 0) {
  process.exit(1)
}
