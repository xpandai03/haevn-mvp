/**
 * Tests for HAEVN AI Summary Mapping Layer
 *
 * Run with: npx tsx lib/ai/buildSummaryInput.test.ts
 */

import type { NormalizedAnswers } from '@/lib/matching/types'
import {
  buildSummaryInput,
  countPopulatedSummaryFields,
  extractAge,
  mapRelationshipIntent,
  mapRelationshipStructure,
  mapSocialStyle,
  mapCommunicationStyle,
  mapDatingPace,
  mapLifestyleRhythm,
  mapValues,
  mapInterests,
} from './buildSummaryInput'

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

function assertNoRawLeaks(label: string, value: unknown) {
  const str = JSON.stringify(value)
  // No raw QIDs
  const hasQID = /\bQ\d+[a-z]?\b/.test(str)
  // No raw numeric scores appearing as values (like "63" standalone)
  const hasRawScore = /"(\d{1,3})"/.test(str) && !/"age":\d+/.test(str)
  assert(`${label}: no raw QIDs or scores in output`,
    !hasQID && !hasRawScore
  )
}

// =============================================================================
// COMPLETE INPUT → FULL OUTPUT
// =============================================================================

console.log('\n=== CORE: Complete Input ===\n')

{
  const answers: NormalizedAnswers = {
    Q1: '1991-04-18',
    Q9: ['Long-term partnership'],
    Q6: ['Monogamous'],
    Q4: 'Single',
    Q36: '3',
    Q36a: '2',
    Q12: 'Address immediately and directly',
    Q12a: 'Once a day',
    Q11: ['Quality time'],
    Q15: 'A few times a month',
    Q18: 'Social drinker',
    Q19a: 'Within 25 miles',
    Q10: "Secure - I'm comfortable with intimacy and independence",
    Q37: '8',
    Q14a: '9',
    Q23: ['Sensual', 'Romantic'],
    Q33: ["I'm curious about kink but new to it"],
    Q34: '8',
  }

  const result = buildSummaryInput({ answers, displayName: 'Alex' })

  assert('first_name = "Alex"', result.first_name === 'Alex')
  assert('age is a number', typeof result.age === 'number' && result.age > 30)
  assert('relationship_intent is a string', typeof result.relationship_intent === 'string')
  assert('relationship_intent contains "Long-term"', result.relationship_intent!.includes('Long-term'))
  assert('relationship_structure contains "Monogamous"', result.relationship_structure!.includes('Monogamous'))
  assert('relationship_structure contains "single"', result.relationship_structure!.includes('single'))
  assert('social_style is about small groups', result.social_style!.includes('one-on-one') || result.social_style!.includes('small'))
  assert('communication_style includes "direct"', result.communication_style!.toLowerCase().includes('direct'))
  assert('communication_style includes "quality time"', result.communication_style!.includes('quality time'))
  assert('dating_pace mentions gradual', result.dating_pace!.toLowerCase().includes('gradual'))
  assert('values is non-empty array', Array.isArray(result.values) && result.values!.length > 0)
  assert('values includes stability or emotional balance', result.values!.some(v => v.includes('stability') || v.includes('emotional')))
  assert('values includes empathy', result.values!.includes('empathy'))
  assert('interests is non-empty array', Array.isArray(result.interests) && result.interests!.length > 0)
  assert('interests includes sensual connection', result.interests!.includes('sensual connection'))

  assertNoRawLeaks('complete input output', result)

  const count = countPopulatedSummaryFields(result)
  assert(`countPopulatedSummaryFields = ${count} (should be 9)`, count === 9)
}

// =============================================================================
// SPARSE INPUT → SPARSE OUTPUT
// =============================================================================

console.log('\n=== CORE: Sparse Input ===\n')

{
  const answers: NormalizedAnswers = {
    Q9: ['Casual dating'],
  }

  const result = buildSummaryInput({ answers, displayName: 'Jordan' })

  assert('first_name = "Jordan"', result.first_name === 'Jordan')
  assert('age is undefined (no Q1)', result.age === undefined)
  assert('relationship_intent is set', result.relationship_intent === 'Casual dating')
  assert('relationship_structure is undefined', result.relationship_structure === undefined)
  assert('social_style is undefined', result.social_style === undefined)
  assert('communication_style is undefined', result.communication_style === undefined)
  assert('dating_pace is undefined', result.dating_pace === undefined)

  const count = countPopulatedSummaryFields(result)
  assert(`countPopulatedSummaryFields = ${count} (should be 1)`, count === 1)
}

// =============================================================================
// AGE EXTRACTION
// =============================================================================

console.log('\n=== extractAge ===\n')

{
  // Birthdate format
  const age1 = extractAge({ Q1: '1991-04-18' } as NormalizedAnswers)
  assert('Birthdate 1991-04-18 → age > 30', age1 !== undefined && age1 >= 33)

  // Numeric age
  const age2 = extractAge({ Q1: '34' } as NormalizedAnswers)
  assert('Numeric "34" → 34', age2 === 34)

  // Invalid
  const age3 = extractAge({ Q1: 'banana' } as NormalizedAnswers)
  assert('Invalid "banana" → undefined', age3 === undefined)

  // Missing
  const age4 = extractAge({} as NormalizedAnswers)
  assert('Missing Q1 → undefined', age4 === undefined)

  // Too young
  const age5 = extractAge({ Q1: '15' } as NormalizedAnswers)
  assert('Age 15 → undefined (under 18)', age5 === undefined)

  // US date format
  const age6 = extractAge({ Q1: '04/18/1991' } as NormalizedAnswers)
  assert('US date 04/18/1991 → age > 30', age6 !== undefined && age6 >= 33)
}

// =============================================================================
// RELATIONSHIP INTENT MAPPING
// =============================================================================

console.log('\n=== mapRelationshipIntent ===\n')

{
  // Single intent
  const r1 = mapRelationshipIntent({ Q9: ['Long-term partnership'] } as NormalizedAnswers)
  assert('Single intent → "Long-term partnership"', r1 === 'Long-term partnership')

  // Multiple intents
  const r2 = mapRelationshipIntent({ Q9: ['Long-term partnership', 'Casual dating'] } as NormalizedAnswers)
  assert('Multi intent → combined', r2 === 'Long-term partnership, open to casual dating')

  // Unknown value preserved as omission
  const r3 = mapRelationshipIntent({ Q9: ['UNKNOWN_THING'] } as NormalizedAnswers)
  assert('Unknown intent → undefined', r3 === undefined)

  // Empty
  const r4 = mapRelationshipIntent({ Q9: [] } as NormalizedAnswers)
  assert('Empty Q9 → undefined', r4 === undefined)

  // Exact labels preserved
  const r5 = mapRelationshipIntent({ Q9: ['Play partners'] } as NormalizedAnswers)
  assert('Play partners → "Play partner connection"', r5 === 'Play partner connection')
}

// =============================================================================
// RELATIONSHIP STRUCTURE MAPPING
// =============================================================================

console.log('\n=== mapRelationshipStructure ===\n')

{
  // Structure + status
  const r1 = mapRelationshipStructure({ Q6: ['ENM'], Q4: 'Partnered' } as NormalizedAnswers)
  assert('ENM + Partnered', r1 === 'Ethically non-monogamous, currently partnered')

  // Structure only
  const r2 = mapRelationshipStructure({ Q6: ['Polyamorous'] } as NormalizedAnswers)
  assert('Polyamorous only', r2 === 'Polyamorous')

  // Status only
  const r3 = mapRelationshipStructure({ Q4: 'Single' } as NormalizedAnswers)
  assert('Single only', r3 === 'Currently single')

  // Neither
  const r4 = mapRelationshipStructure({} as NormalizedAnswers)
  assert('Neither → undefined', r4 === undefined)
}

// =============================================================================
// SOCIAL STYLE MAPPING
// =============================================================================

console.log('\n=== mapSocialStyle ===\n')

{
  // Low energy (1-3)
  const r1 = mapSocialStyle({ Q36: '2' } as NormalizedAnswers)
  assert('Score 2 → one-on-one/small', r1!.includes('one-on-one') || r1!.includes('small'))

  // Medium (4-5)
  const r2 = mapSocialStyle({ Q36: '5' } as NormalizedAnswers)
  assert('Score 5 → both social and quieter', r2!.includes('both'))

  // Medium-high (6-7)
  const r3 = mapSocialStyle({ Q36: '7' } as NormalizedAnswers)
  assert('Score 7 → mix of social', r3!.includes('mix'))

  // High (8-10)
  const r4 = mapSocialStyle({ Q36: '9' } as NormalizedAnswers)
  assert('Score 9 → active social', r4!.includes('active'))

  // Missing
  const r5 = mapSocialStyle({} as NormalizedAnswers)
  assert('Missing → undefined', r5 === undefined)

  // Falls back to Q36a
  const r6 = mapSocialStyle({ Q36a: '2' } as NormalizedAnswers)
  assert('Q36a fallback works', r6 !== undefined)
}

// =============================================================================
// COMMUNICATION STYLE
// =============================================================================

console.log('\n=== mapCommunicationStyle ===\n')

{
  const r1 = mapCommunicationStyle({
    Q12: 'Address immediately and directly',
    Q12a: 'Once a day',
    Q11: ['Quality time'],
  } as NormalizedAnswers)
  assert('Direct + steady + quality time', r1 === 'Direct and steady, values quality time')

  const r2 = mapCommunicationStyle({
    Q12: 'Take time to cool down first',
  } as NormalizedAnswers)
  assert('Reflective only', r2 === 'Reflective')

  const r3 = mapCommunicationStyle({} as NormalizedAnswers)
  assert('Missing → undefined', r3 === undefined)
}

// =============================================================================
// DATING PACE
// =============================================================================

console.log('\n=== mapDatingPace ===\n')

{
  const r1 = mapDatingPace({ Q15: 'A few times a month' } as NormalizedAnswers)
  assert('Few times/month → gradual', r1!.toLowerCase().includes('gradual'))

  const r2 = mapDatingPace({ Q15: "Unlimited - I'm very available" } as NormalizedAnswers)
  assert('Unlimited → available', r2!.toLowerCase().includes('available'))

  const r3 = mapDatingPace({} as NormalizedAnswers)
  assert('Missing → undefined', r3 === undefined)
}

// =============================================================================
// LIFESTYLE RHYTHM
// =============================================================================

console.log('\n=== mapLifestyleRhythm ===\n')

{
  const r1 = mapLifestyleRhythm({ Q36: '2' } as NormalizedAnswers)
  assert('Low social → quieter', r1!.toLowerCase().includes('quiet'))

  const r2 = mapLifestyleRhythm({ Q36: '5' } as NormalizedAnswers)
  assert('Mid social → balanced', r2!.toLowerCase().includes('balanced'))

  const r3 = mapLifestyleRhythm({ Q36: '9' } as NormalizedAnswers)
  assert('High social → active', r3!.toLowerCase().includes('active'))

  const r4 = mapLifestyleRhythm({ Q18: 'Sober', Q19a: 'My neighborhood only' } as NormalizedAnswers)
  assert('Sober + local → locally rooted', r4!.toLowerCase().includes('local'))

  const r5 = mapLifestyleRhythm({} as NormalizedAnswers)
  assert('Missing → undefined', r5 === undefined)
}

// =============================================================================
// VALUES
// =============================================================================

console.log('\n=== mapValues ===\n')

{
  const r1 = mapValues({
    Q10: "Secure - I'm comfortable with intimacy and independence",
    Q37: '8',
    Q14a: '9',
    Q9: ['Long-term partnership'],
  } as NormalizedAnswers)
  assert('Secure + high empathy + high cultural + LTR', r1.length >= 3)
  assert('Includes stability', r1.includes('stability'))
  assert('Includes empathy', r1.includes('empathy'))
  assert('Includes intentional connection', r1.includes('intentional connection'))

  // Low empathy = no empathy value
  const r2 = mapValues({ Q37: '3' } as NormalizedAnswers)
  assert('Low empathy → no empathy value', !r2.includes('empathy'))

  // Empty
  const r3 = mapValues({} as NormalizedAnswers)
  assert('No inputs → empty array', r3.length === 0)
}

// =============================================================================
// INTERESTS
// =============================================================================

console.log('\n=== mapInterests ===\n')

{
  const r1 = mapInterests({
    Q23: ['Sensual', 'Romantic', 'Kinky'],
    Q33: ["I'm curious about kink but new to it"],
    Q34: '8',
  } as NormalizedAnswers)
  assert('Multiple erotic styles mapped', r1.length >= 2)
  assert('Includes sensual connection', r1.includes('sensual connection'))
  assert('Includes romantic connection', r1.includes('romantic connection'))
  assert('Capped at 4', r1.length <= 4)

  // No explicit content leaks
  assert('No raw "Kinky" in output', !r1.includes('Kinky'))
  assert('No raw "kinky" in output', !r1.includes('kinky'))

  // Vanilla omitted
  const r2 = mapInterests({ Q23: ['Vanilla'] } as NormalizedAnswers)
  assert('Vanilla → omitted', r2.length === 0)

  // "Not into kink" omitted
  const r3 = mapInterests({
    Q33: ["I'm not into kink and prefer conventional intimacy"],
  } as NormalizedAnswers)
  assert('"Not into kink" → omitted', r3.length === 0)

  // Empty
  const r4 = mapInterests({} as NormalizedAnswers)
  assert('No inputs → empty', r4.length === 0)
}

// =============================================================================
// OUTPUT SAFETY: No raw values leak
// =============================================================================

console.log('\n=== OUTPUT SAFETY ===\n')

{
  const answers: NormalizedAnswers = {
    Q1: '1991-04-18',
    Q9: ['Long-term partnership', 'Play partners'],
    Q6: ['ENM'],
    Q4: 'Partnered',
    Q36: '6',
    Q12: 'Take time to cool down first',
    Q12a: 'Every few days',
    Q11: ['Physical touch'],
    Q15: 'Once or twice a week',
    Q10: 'Anxious - I crave closeness but worry about relationships',
    Q37: '9',
    Q23: ['Experimental', 'Primal'],
    Q33: ["I'm into BDSM and/or power dynamics"],
    Q34: '9',
  }

  const result = buildSummaryInput({ answers, displayName: 'Taylor' })
  const json = JSON.stringify(result)

  // No raw slider numbers as descriptor values
  assert('No "6" as a descriptor value', !json.includes('"6"'))
  assert('No "9" as a descriptor value (except age)', !json.replace(/"age":\d+/, '').includes('"9"'))

  // No raw survey option strings
  assert('No "Experimental" raw value', !json.includes('Experimental'))
  assert('No "Primal" raw value', !json.includes('Primal'))
  assert('No "BDSM" in output', !json.includes('BDSM'))
  assert('No "Anxious -" raw label', !json.includes('Anxious -'))

  // All values are human-readable
  assert('relationship_intent is readable', typeof result.relationship_intent === 'string')
  assert('communication_style is readable', typeof result.communication_style === 'string')
}

// =============================================================================
// SUMMARY
// =============================================================================

console.log(`\n${'='.repeat(60)}`)
console.log(`MAPPING LAYER TESTS: ${passed} passed, ${failed} failed out of ${passed + failed} total`)
console.log(`${'='.repeat(60)}\n`)

if (failed > 0) {
  process.exit(1)
}
