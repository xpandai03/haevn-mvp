/**
 * P0 Gate Tests — Age Range, Distance Cap, Race Variable Gate
 *
 * Run with: npx tsx lib/matching/gates.test.ts
 */

import type { NormalizedAnswers } from './types'
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

// =============================================================================
// AGE RANGE GATE TESTS
// =============================================================================

console.log('\n=== AGE RANGE GATE ===\n')

// Pass: both directions within range
{
  const user: NormalizedAnswers = { Q1: '1994-06-15', Q_AGE_MIN: '25', Q_AGE_MAX: '40' }
  const match: NormalizedAnswers = { Q1: '1990-03-20', Q_AGE_MIN: '28', Q_AGE_MAX: '38' }
  const result = checkAgeRangeConstraint(user, match)
  assert('Pass both directions — ages within mutual ranges', result.passed === true)
}

// Fail: Match age outside User's preferred range
{
  const user: NormalizedAnswers = { Q1: '1995-01-01', Q_AGE_MIN: '26', Q_AGE_MAX: '35' }
  const match: NormalizedAnswers = { Q1: '1982-01-01', Q_AGE_MIN: '25', Q_AGE_MAX: '40' }
  // Match age ~44, User max is 35
  const result = checkAgeRangeConstraint(user, match)
  assert('Fail — Match age outside User preferred range', result.passed === false)
  assert('  blockedBy is age_range', result.blockedBy === 'age_range')
  assert('  reason mentions User preferred range', result.reason?.includes('User preferred range') === true)
}

// Fail: User age outside Match's preferred range
{
  const user: NormalizedAnswers = { Q1: '1990-01-01', Q_AGE_MIN: '20', Q_AGE_MAX: '50' }
  const match: NormalizedAnswers = { Q1: '1996-01-01', Q_AGE_MIN: '25', Q_AGE_MAX: '32' }
  // User age ~36, Match max is 32
  const result = checkAgeRangeConstraint(user, match)
  assert('Fail — User age outside Match preferred range', result.passed === false)
  assert('  blockedBy is age_range', result.blockedBy === 'age_range')
  assert('  reason mentions Match preferred range', result.reason?.includes('Match preferred range') === true)
}

// Pass: Missing age data → skip gate
{
  const user: NormalizedAnswers = { Q_AGE_MIN: '25', Q_AGE_MAX: '35' }
  const match: NormalizedAnswers = { Q1: '1990-01-01', Q_AGE_MIN: '25', Q_AGE_MAX: '40' }
  const result = checkAgeRangeConstraint(user, match)
  assert('Pass — User age missing, gate skipped', result.passed === true)
}

// Pass: Missing preference data → skip gate (preference not set)
{
  const user: NormalizedAnswers = { Q1: '1990-01-01' }
  const match: NormalizedAnswers = { Q1: '1995-01-01' }
  const result = checkAgeRangeConstraint(user, match)
  assert('Pass — No age preferences set, gate skipped', result.passed === true)
}

// Pass: Numeric age instead of birthdate
{
  const user: NormalizedAnswers = { Q1: '30', Q_AGE_MIN: '25', Q_AGE_MAX: '35' }
  const match: NormalizedAnswers = { Q1: '32', Q_AGE_MIN: '28', Q_AGE_MAX: '40' }
  const result = checkAgeRangeConstraint(user, match)
  assert('Pass — Numeric ages within range', result.passed === true)
}

// =============================================================================
// DISTANCE CAP GATE TESTS
// =============================================================================

console.log('\n=== DISTANCE CAP GATE ===\n')

// Pass: within both caps (SF to Oakland ~12 miles)
{
  const user: NormalizedAnswers = {
    Q19a: 'Within 25 miles',
    _latitude: 37.7749, _longitude: -122.4194, // San Francisco
  }
  const match: NormalizedAnswers = {
    Q19a: 'Within 50 miles',
    _latitude: 37.8044, _longitude: -122.2712, // Oakland
  }
  const result = checkDistanceConstraint(user, match)
  assert('Pass — SF to Oakland within both caps', result.passed === true)
}

// Fail: exceeds User's cap (SF to LA ~347 miles)
{
  const user: NormalizedAnswers = {
    Q19a: 'Within 50 miles',
    _latitude: 37.7749, _longitude: -122.4194, // San Francisco
  }
  const match: NormalizedAnswers = {
    Q19a: 'Any distance',
    _latitude: 34.0522, _longitude: -118.2437, // Los Angeles
  }
  const result = checkDistanceConstraint(user, match)
  assert('Fail — SF to LA exceeds User 50mi cap', result.passed === false)
  assert('  blockedBy is distance', result.blockedBy === 'distance')
  assert('  reason mentions User max', result.reason?.includes('User max') === true)
}

// Fail: exceeds Match's cap
{
  const user: NormalizedAnswers = {
    Q19a: 'Any distance',
    _latitude: 37.7749, _longitude: -122.4194, // San Francisco
  }
  const match: NormalizedAnswers = {
    Q19a: 'Within 10 miles',
    _latitude: 37.3382, _longitude: -121.8863, // San Jose (~42 miles)
  }
  const result = checkDistanceConstraint(user, match)
  assert('Fail — SF to San Jose exceeds Match 10mi cap', result.passed === false)
  assert('  blockedBy is distance', result.blockedBy === 'distance')
  assert('  reason mentions Match max', result.reason?.includes('Match max') === true)
}

// Pass: missing coordinates → skip gate
{
  const user: NormalizedAnswers = { Q19a: 'Within 25 miles' }
  const match: NormalizedAnswers = { Q19a: 'Within 50 miles', _latitude: 37.7749, _longitude: -122.4194 }
  const result = checkDistanceConstraint(user, match)
  assert('Pass — User coordinates missing, gate skipped', result.passed === true)
}

// Pass: "Any distance" vs "Any distance"
{
  const user: NormalizedAnswers = {
    Q19a: 'Any distance',
    _latitude: 37.7749, _longitude: -122.4194,
  }
  const match: NormalizedAnswers = {
    Q19a: 'Any distance',
    _latitude: 34.0522, _longitude: -118.2437,
  }
  const result = checkDistanceConstraint(user, match)
  assert('Pass — Both "Any distance"', result.passed === true)
}

// Pass: "My neighborhood only" but very close (~0.5 miles)
{
  const user: NormalizedAnswers = {
    Q19a: 'My neighborhood only',
    _latitude: 37.7749, _longitude: -122.4194,
  }
  const match: NormalizedAnswers = {
    Q19a: 'My neighborhood only',
    _latitude: 37.7780, _longitude: -122.4180, // ~0.2 miles away
  }
  const result = checkDistanceConstraint(user, match)
  assert('Pass — Same neighborhood, within 5mi cap', result.passed === true)
}

// =============================================================================
// RACE VARIABLE GATE TESTS
// =============================================================================

console.log('\n=== RACE VARIABLE GATE ===\n')

// Case A: "any" only → pass
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['White / Caucasian'],
    Q_RACE_PREFERENCE: ['Any'],
  }
  const match: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Black / African American'],
    Q_RACE_PREFERENCE: ['Any'],
  }
  const result = checkRaceConstraint(user, match)
  assert('Case A — "Any" only → pass', result.passed === true)
}

// Case B: "any" + specific races → not a hard gate, passes
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['White / Caucasian'],
    Q_RACE_PREFERENCE: ['Any', 'Black / African American', 'Hispanic / Latino'],
  }
  const match: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Asian'],
    Q_RACE_PREFERENCE: ['Any'],
  }
  const result = checkRaceConstraint(user, match)
  assert('Case B — "Any" + specifics → pass (not a gate)', result.passed === true)
}

// Case C: specific races only, compatible → pass
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['White / Caucasian'],
    Q_RACE_PREFERENCE: ['Asian', 'White / Caucasian'],
  }
  const match: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Asian'],
    Q_RACE_PREFERENCE: ['White / Caucasian', 'Asian'],
  }
  const result = checkRaceConstraint(user, match)
  assert('Case C — Specific only, compatible → pass', result.passed === true)
}

// Case C: specific races only, incompatible → fail
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['White / Caucasian'],
    Q_RACE_PREFERENCE: ['Asian'],
  }
  const match: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Black / African American'],
    Q_RACE_PREFERENCE: ['Any'],
  }
  const result = checkRaceConstraint(user, match)
  assert('Case C — User specific "Asian", Match is "Black" → fail', result.passed === false)
  assert('  blockedBy is race', result.blockedBy === 'race')
  assert('  reason mentions User race preference excludes Match', result.reason?.includes('User') === true)
}

// Case C bidirectional: Match's preference excludes User
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Hispanic / Latino'],
    Q_RACE_PREFERENCE: ['Any'],
  }
  const match: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['White / Caucasian'],
    Q_RACE_PREFERENCE: ['White / Caucasian', 'Asian'],
  }
  const result = checkRaceConstraint(user, match)
  assert('Case C bidirectional — Match preference excludes User → fail', result.passed === false)
  assert('  blockedBy is race', result.blockedBy === 'race')
  assert('  reason mentions Match race preference', result.reason?.includes('Match') === true)
}

// Missing data: no preference set → pass
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Asian'],
  }
  const match: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['White / Caucasian'],
  }
  const result = checkRaceConstraint(user, match)
  assert('Missing data — No preferences set → pass', result.passed === true)
}

// Missing data: no identity on one side → pass
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Asian'],
    Q_RACE_PREFERENCE: ['Asian'],
  }
  const match: NormalizedAnswers = {}
  const result = checkRaceConstraint(user, match)
  assert('Missing data — Match has no identity → pass (skip)', result.passed === true)
}

// "open_to_all" synonym → pass
{
  const user: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['Asian'],
    Q_RACE_PREFERENCE: ['open_to_all'],
  }
  const match: NormalizedAnswers = {
    Q_RACE_IDENTITY: ['White / Caucasian'],
    Q_RACE_PREFERENCE: ['no_preference'],
  }
  const result = checkRaceConstraint(user, match)
  assert('"open_to_all" and "no_preference" synonyms → pass', result.passed === true)
}

// =============================================================================
// SUMMARY
// =============================================================================

console.log(`\n${'='.repeat(50)}`)
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} total`)
console.log(`${'='.repeat(50)}\n`)

if (failed > 0) {
  process.exit(1)
}
