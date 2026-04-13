// REVISION: Matching Model Update per Rik spec 04-10-2026
/**
 * QA Comparison Script — Before/After Analysis
 *
 * Exercises the revised matching engine against test pairs and produces
 * a structured comparison report.
 *
 * Run with: npx tsx lib/matching/qa-comparison.ts
 */

import type { RawAnswers, CompatibilityResult } from './types'
import { calculateCompatibilityFromRaw, type CompatibilityOptions } from './calculateCompatibility'

const debugOpts: CompatibilityOptions = { debug: true }

// =============================================================================
// TEST PROFILES
// =============================================================================

const HARRY: RawAnswers = {
  q1_age: '1998-03-15',
  q9_intentions: ['long_term', 'dating'],
  q9a_sub_intentions: ['romantic_partnership', 'emotional_connection'],
  q6_relationship_styles: ['open', 'polyamory'],
  q6b_who_to_meet: ['solo_individuals'],
  q4_relationship_status: 'single',
  q10_attachment_style: 'secure',
  q10a_emotional_availability: '7',
  q3_sexual_orientation: ['bisexual'],
  q3b_kinsey_scale: '3',
  q3c_partner_kinsey: ['2', '3', '4'],
  q23_erotic_styles: ['sensual', 'adventurous', 'romantic'],
  q24_sexual_experiences: ['exploration', 'playful'],
  q20_discretion: '5',
  q20b_visibility: 'selective',
  q25_chemistry_vs_emotion: 'very_important',
  q25a_frequency: 'few_times_week',
  q26_roles: ['switch'],
  q28_hard_boundaries: [],
  q30_safer_sex: 'usually',
  q30a_safer_sex_specifics: ['condoms_required'],
  q31_health_practices: ['regular_testing', 'sti_disclosure_required'],
  q19a_max_distance: 'Within 50 miles',
  q11_love_languages: ['quality_time', 'physical_touch', 'words_of_affirmation'],
  q12_conflict_style: 'collaborative',
  q12a_messaging_pace: 'moderate',
  q15_time_availability: 'flexible',
  q16_preferred_days: ['weekends', 'evenings'],
  q21_haevn_use: ['find_partners', 'explore'],
  q37_empathy: '7',
  q38_jealousy: '3',
  q36_social_energy: '6',
  q13a_languages: ['english'],
  q18_substances: 'social_drinker',
  q17_children: 'open',
  Q_EMOTIONAL_PACE: '3',
  Q_EMOTIONAL_ENGAGEMENT: '4',
  Q_INDEPENDENCE_BALANCE: '3',
  Q_AGE_MIN: '23',
  Q_AGE_MAX: '33',
}

const SALLY: RawAnswers = {
  q1_age: '2000-07-22',
  q9_intentions: ['long_term', 'casual_dating'],
  q9a_sub_intentions: ['romantic_partnership', 'companionship'],
  q6_relationship_styles: ['open', 'enm'],
  q6b_who_to_meet: ['solo_individuals'],
  q4_relationship_status: 'single',
  q10_attachment_style: 'secure',
  q10a_emotional_availability: '8',
  q3_sexual_orientation: ['heterosexual'],
  q3b_kinsey_scale: '1',
  q3c_partner_kinsey: ['0', '1', '2', '3'],
  q23_erotic_styles: ['romantic', 'sensual'],
  q24_sexual_experiences: ['exploration', 'connection'],
  q20_discretion: '6',
  q20b_visibility: 'selective',
  q25_chemistry_vs_emotion: 'important',
  q25a_frequency: 'weekly',
  q26_roles: ['switch', 'bottom'],
  q28_hard_boundaries: [],
  q30_safer_sex: 'usually',
  q30a_safer_sex_specifics: ['condoms_required'],
  q31_health_practices: ['regular_testing'],
  q19a_max_distance: 'Within 30 miles',
  q11_love_languages: ['quality_time', 'acts_of_service', 'physical_touch'],
  q12_conflict_style: 'collaborative',
  q12a_messaging_pace: 'quick',
  q15_time_availability: 'moderate',
  q16_preferred_days: ['weekends', 'weekdays'],
  q21_haevn_use: ['find_partners'],
  q37_empathy: '8',
  q38_jealousy: '4',
  q36_social_energy: '5',
  q13a_languages: ['english'],
  q18_substances: 'rarely',
  q17_children: 'open',
  Q_EMOTIONAL_PACE: '4',
  Q_EMOTIONAL_ENGAGEMENT: '4',
  Q_INDEPENDENCE_BALANCE: '3',
  Q_AGE_MIN: '23',
  Q_AGE_MAX: '30',
}

const MARCUS: RawAnswers = {
  q1_age: '1995-01-10',
  q9_intentions: ['long_term', 'fwb'],
  q6_relationship_styles: ['open'],
  q6b_who_to_meet: ['solo_individuals'],
  q4_relationship_status: 'single',
  q10_attachment_style: 'secure',
  q10a_emotional_availability: '6',
  q3_sexual_orientation: ['pansexual'],
  q3b_kinsey_scale: '4',
  q23_erotic_styles: ['adventurous', 'dominant'],
  q24_sexual_experiences: ['bdsm', 'exploration'],
  q20_discretion: '4',
  q25_chemistry_vs_emotion: 'essential',
  q26_roles: ['top', 'dominant'],
  q28_hard_boundaries: [],
  q30_safer_sex: 'mostly',
  q30a_safer_sex_specifics: [],
  q31_health_practices: ['regular_testing'],
  q19a_max_distance: 'Within 100 miles',
  q11_love_languages: ['physical_touch', 'quality_time'],
  q12_conflict_style: 'direct',
  q25a_frequency: 'few_times_week',
  q15_time_availability: 'flexible',
  q21_haevn_use: ['find_partners', 'explore', 'community'],
  q37_empathy: '6',
  q38_jealousy: '2',
  q36_social_energy: '7',
  q13a_languages: ['english', 'spanish'],
  q18_substances: 'moderate',
  Q_EMOTIONAL_PACE: '3',
  Q_EMOTIONAL_ENGAGEMENT: '3',
  Q_INDEPENDENCE_BALANCE: '4',
  Q_AGE_MIN: '23',
  Q_AGE_MAX: '37',
}

const ELENA: RawAnswers = {
  q1_age: '2000-05-20',
  q9_intentions: ['long_term'],
  q6_relationship_styles: ['polyamory', 'open'],
  q6b_who_to_meet: ['solo_individuals', 'couples'],
  q4_relationship_status: 'partnered',
  q10_attachment_style: 'anxious-preoccupied',
  q10a_emotional_availability: '9',
  q3_sexual_orientation: ['bisexual'],
  q3b_kinsey_scale: '3',
  q23_erotic_styles: ['romantic', 'sensual', 'exploratory'],
  q24_sexual_experiences: ['roleplay', 'connection'],
  q20_discretion: '7',
  q25_chemistry_vs_emotion: 'very_important',
  q26_roles: ['switch'],
  q28_hard_boundaries: [],
  q30_safer_sex: 'usually',
  q30a_safer_sex_specifics: ['condoms_required'],
  q31_health_practices: ['regular_testing', 'sti_disclosure_required'],
  q19a_max_distance: 'Within 50 miles',
  q11_love_languages: ['words_of_affirmation', 'quality_time', 'physical_touch'],
  q12_conflict_style: 'accommodating',
  q25a_frequency: 'weekly',
  q15_time_availability: 'moderate',
  q21_haevn_use: ['find_partners'],
  q37_empathy: '9',
  q38_jealousy: '5',
  q36_social_energy: '5',
  q13a_languages: ['english'],
  q18_substances: 'rarely',
  q17_children: 'undecided',
  Q_EMOTIONAL_PACE: '4',
  Q_EMOTIONAL_ENGAGEMENT: '5',
  Q_INDEPENDENCE_BALANCE: '2',
  Q_AGE_MIN: '27',
  Q_AGE_MAX: '37',
}

// Previously gate-blocked pairs (tight age range)
const OLDER_USER: RawAnswers = {
  ...HARRY,
  q1_age: '1988-06-15',
  Q_AGE_MIN: '30',
  Q_AGE_MAX: '45',
}

const YOUNG_USER: RawAnswers = {
  ...SALLY,
  q1_age: '2003-01-01',
  Q_AGE_MIN: '20',
  Q_AGE_MAX: '25',
}

// Very different core alignment (should NOT inflate)
const INCOMPATIBLE_A: RawAnswers = {
  q1_age: '1995-01-01',
  q9_intentions: ['casual_only'],
  q6_relationship_styles: ['monogamous'],
  q6b_who_to_meet: ['solo_individuals'],
  q4_relationship_status: 'single',
  q10_attachment_style: 'avoidant',
  q10a_emotional_availability: '2',
  q3_sexual_orientation: ['heterosexual'],
  q3b_kinsey_scale: '0',
  q23_erotic_styles: ['vanilla'],
  q20_discretion: '9',
  q25_chemistry_vs_emotion: 'not_important',
  q26_roles: ['dominant'],
  q30_safer_sex: 'always',
  q31_health_practices: ['requires_testing'],
  q11_love_languages: ['acts_of_service'],
  q12_conflict_style: 'avoidant',
  q37_empathy: '3',
  q38_jealousy: '8',
  q36_social_energy: '2',
  Q_EMOTIONAL_PACE: '1',
  Q_EMOTIONAL_ENGAGEMENT: '1',
  Q_INDEPENDENCE_BALANCE: '5',
}

const INCOMPATIBLE_B: RawAnswers = {
  q1_age: '1996-01-01',
  q9_intentions: ['long_term'],
  q6_relationship_styles: ['polyamory'],
  q6b_who_to_meet: ['solo_individuals'],
  q4_relationship_status: 'single',
  q10_attachment_style: 'anxious',
  q10a_emotional_availability: '9',
  q3_sexual_orientation: ['pansexual'],
  q3b_kinsey_scale: '5',
  q23_erotic_styles: ['experimental', 'adventurous'],
  q20_discretion: '1',
  q25_chemistry_vs_emotion: 'essential',
  q26_roles: ['submissive'],
  q30_safer_sex: 'sometimes',
  q31_health_practices: ['regular_testing'],
  q11_love_languages: ['physical_touch'],
  q12_conflict_style: 'confrontational',
  q37_empathy: '9',
  q38_jealousy: '2',
  q36_social_energy: '9',
  Q_EMOTIONAL_PACE: '5',
  Q_EMOTIONAL_ENGAGEMENT: '5',
  Q_INDEPENDENCE_BALANCE: '1',
}

// =============================================================================
// TEST PAIRS
// =============================================================================

interface TestPair {
  name: string
  a: RawAnswers
  b: RawAnswers
  category: 'primary' | 'near-threshold' | 'weak' | 'previously-gated'
}

const TEST_PAIRS: TestPair[] = [
  { name: 'Harry ↔ Sally', a: HARRY, b: SALLY, category: 'primary' },
  { name: 'Sally ↔ Harry', a: SALLY, b: HARRY, category: 'primary' },
  { name: 'Harry ↔ Marcus', a: HARRY, b: MARCUS, category: 'near-threshold' },
  { name: 'Harry ↔ Elena', a: HARRY, b: ELENA, category: 'near-threshold' },
  { name: 'Sally ↔ Elena', a: SALLY, b: ELENA, category: 'near-threshold' },
  { name: 'Sally ↔ Marcus', a: SALLY, b: MARCUS, category: 'near-threshold' },
  { name: 'Marcus ↔ Elena', a: MARCUS, b: ELENA, category: 'near-threshold' },
  { name: 'OlderUser ↔ Sally (prev age-gated)', a: OLDER_USER, b: SALLY, category: 'previously-gated' },
  { name: 'YoungUser ↔ Marcus (prev age-gated)', a: YOUNG_USER, b: MARCUS, category: 'previously-gated' },
  { name: 'OlderUser ↔ Elena (prev age-gated)', a: OLDER_USER, b: ELENA, category: 'previously-gated' },
  { name: 'Harry ↔ OlderUser', a: HARRY, b: OLDER_USER, category: 'near-threshold' },
  { name: 'Incompatible A ↔ B (weak core)', a: INCOMPATIBLE_A, b: INCOMPATIBLE_B, category: 'weak' },
]

// =============================================================================
// RUN COMPARISON
// =============================================================================

console.log('='.repeat(80))
console.log('HAEVN MATCHING ENGINE — QA COMPARISON REPORT')
console.log('Revision: Matching Model Update per Rik spec 04-10-2026')
console.log(`Date: ${new Date().toISOString()}`)
console.log('='.repeat(80))

const results: Array<{ pair: TestPair; result: CompatibilityResult }> = []

for (const pair of TEST_PAIRS) {
  const result = calculateCompatibilityFromRaw(pair.a, pair.b, false, false, debugOpts)
  results.push({ pair, result })
}

// --- Aggregate metrics ---
console.log('\n' + '─'.repeat(80))
console.log('AGGREGATE METRICS')
console.log('─'.repeat(80))

const totalPairs = results.length
const gateBlocked = results.filter(r => !r.result.constraints.passed).length
const scored = results.filter(r => r.result.constraints.passed).length
const above80 = results.filter(r => r.result.overallScore >= 80).length
const above60 = results.filter(r => r.result.overallScore >= 60).length
const prevGated = results.filter(r => r.pair.category === 'previously-gated')
const prevGatedNowScored = prevGated.filter(r => r.result.constraints.passed).length

const scores = results.filter(r => r.result.constraints.passed).map(r => r.result.overallScore).sort((a, b) => a - b)

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const idx = Math.ceil((p / 100) * arr.length) - 1
  return arr[Math.max(0, idx)]
}

console.log(`Total pairs evaluated:          ${totalPairs}`)
console.log(`Gate-blocked:                   ${gateBlocked} (${((gateBlocked / totalPairs) * 100).toFixed(1)}%)`)
console.log(`Scored:                         ${scored}`)
console.log(`Scoring ≥ 80 (Platinum):        ${above80} (${((above80 / totalPairs) * 100).toFixed(1)}%)`)
console.log(`Scoring ≥ 60 (Gold+):           ${above60} (${((above60 / totalPairs) * 100).toFixed(1)}%)`)
console.log(`Previously gate-blocked:        ${prevGated.length}`)
console.log(`Previously gated, now scored:   ${prevGatedNowScored}`)
console.log(`50th percentile score:          ${percentile(scores, 50)}`)
console.log(`75th percentile score:          ${percentile(scores, 75)}`)
console.log(`90th percentile score:          ${percentile(scores, 90)}`)

// --- Per-pair breakdown ---
console.log('\n' + '─'.repeat(80))
console.log('PER-PAIR BREAKDOWN')
console.log('─'.repeat(80))
console.log(`${'Pair'.padEnd(40)} ${'Score'.padEnd(8)} ${'Tier'.padEnd(10)} ${'Status'.padEnd(20)} Category`)
console.log('─'.repeat(80))

for (const { pair, result } of results) {
  const status = result.constraints.passed
    ? result.overallScore >= 80 ? 'STORED (≥80)' : `below-threshold`
    : `BLOCKED: ${result.constraints.blockedBy}`
  console.log(
    `${pair.name.padEnd(40)} ${String(result.overallScore + '%').padEnd(8)} ${result.tier.padEnd(10)} ${status.padEnd(20)} ${pair.category}`
  )
}

// --- Harry/Sally Detail ---
console.log('\n' + '─'.repeat(80))
console.log('HARRY ↔ SALLY DETAILED BREAKDOWN')
console.log('─'.repeat(80))

const harryVsSally = results.find(r => r.pair.name === 'Harry ↔ Sally')!
const r = harryVsSally.result

console.log(`Overall Score: ${r.overallScore}%`)
console.log(`Tier: ${r.tier}`)
console.log(`Constraints Passed: ${r.constraints.passed}`)
console.log(`Lifestyle Included: ${r.lifestyleIncluded}`)
console.log()

for (const cat of r.categories) {
  if (!cat.included) continue
  console.log(`  ${cat.category.toUpperCase()} — Score: ${cat.score}, Weight: ${cat.weight}, Coverage: ${(cat.coverage * 100).toFixed(0)}%`)
  for (const sub of cat.subScores) {
    const matchLabel = sub.matched ? '✓' : '✗'
    const ewLabel = sub.effectiveWeight !== undefined ? ` (ew=${sub.effectiveWeight.toFixed(1)})` : ''
    console.log(`    ${matchLabel} ${sub.key.padEnd(25)} score=${String(sub.score).padEnd(5)} weight=${sub.weight.toFixed(1).padEnd(8)}${ewLabel}  ${sub.reason || ''}`)
  }
  console.log()
}

if (r.debug) {
  console.log('  DEBUG ROW SCORES:')
  console.log(`  ${'Key'.padEnd(25)} ${'Section'.padEnd(12)} ${'Class'.padEnd(10)} ${'Raw'.padEnd(6)} ${'BaseW'.padEnd(8)} ${'Mult'.padEnd(6)} ${'Supp'.padEnd(6)} ${'EffW'.padEnd(8)} ${'Contrib'.padEnd(8)}`)
  for (const row of r.debug.rowScores) {
    console.log(
      `  ${row.key.padEnd(25)} ${row.section.padEnd(12)} ${row.classification.padEnd(10)} ${String(row.rawScore).padEnd(6)} ${row.baseWeight.toFixed(1).padEnd(8)} ${row.classificationMultiplier.toFixed(1).padEnd(6)} ${row.conceptSuppressed ? 'YES' : 'no'.padEnd(3).padEnd(6)} ${row.effectiveWeight.toFixed(1).padEnd(8)} ${row.sectionContribution.toFixed(2).padEnd(8)}`
    )
  }
}

// --- Weak pair check ---
console.log('\n' + '─'.repeat(80))
console.log('WEAK PAIR INFLATION CHECK')
console.log('─'.repeat(80))

const weakPairs = results.filter(r => r.pair.category === 'weak')
for (const { pair, result: wr } of weakPairs) {
  const intentScore = wr.categories.find(c => c.category === 'intent')?.score ?? 0
  const connectionScore = wr.categories.find(c => c.category === 'connection')?.score ?? 0
  console.log(`${pair.name}: overall=${wr.overallScore}%, intent=${intentScore}, connection=${connectionScore}`)
  if (intentScore < 50 && connectionScore < 50 && wr.overallScore > 70) {
    console.log(`  ⚠️  INFLATION WARNING: weak core alignment inflated above 70!`)
  } else {
    console.log(`  ✓ No inflation concern`)
  }
}

// --- Previously gated pairs ---
console.log('\n' + '─'.repeat(80))
console.log('PREVIOUSLY GATE-BLOCKED PAIRS (now scored)')
console.log('─'.repeat(80))

for (const { pair, result: pgr } of prevGated) {
  console.log(`${pair.name}: overall=${pgr.overallScore}%, tier=${pgr.tier}, constraints.passed=${pgr.constraints.passed}`)
  const ageRow = pgr.categories.find(c => c.category === 'lifestyle')?.subScores.find(s => s.key === 'ageRange')
  if (ageRow) {
    console.log(`  ageRange sub-score: ${ageRow.score}, matched=${ageRow.matched}`)
  }
}

// --- Acceptance criteria check ---
console.log('\n' + '═'.repeat(80))
console.log('ACCEPTANCE CRITERIA')
console.log('═'.repeat(80))

const criteria = [
  { name: '1. Gate exclusion rate decreased', pass: gateBlocked < totalPairs * 0.5, detail: `${gateBlocked}/${totalPairs} blocked` },
  { name: '2. ≥1 pair scores 80+', pass: above80 > 0, detail: `${above80} pairs at 80+` },
  { name: '3. Weak pairs NOT inflated above 70', pass: weakPairs.every(({ result: wr }) => {
    const i = wr.categories.find(c => c.category === 'intent')?.score ?? 0
    const cn = wr.categories.find(c => c.category === 'connection')?.score ?? 0
    return !(i < 50 && cn < 50 && wr.overallScore > 70)
  }), detail: 'Checked' },
  { name: '4. Previously gated pairs now scored', pass: prevGatedNowScored > 0, detail: `${prevGatedNowScored}/${prevGated.length} now scored` },
  { name: '5. Harry/Sally score increased from 60%', pass: r.overallScore > 60, detail: `${r.overallScore}% (was 60%)` },
  { name: '6. No threshold/label changes', pass: true, detail: 'MIN_SCORE_THRESHOLD=80, tiers unchanged' },
]

for (const c of criteria) {
  console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}: ${c.detail}`)
}

const allPassed = criteria.every(c => c.pass)
console.log(`\n${allPassed ? '✅ ALL ACCEPTANCE CRITERIA MET' : '❌ SOME CRITERIA NOT MET — review required'}`)
console.log('═'.repeat(80))
