/**
 * Enriched answer comparison — the filter contract, decoding, the token cap,
 * and the sexual-compatibility verbatim guard.
 *
 * Run: npx tsx lib/matches/__tests__/enrichedAnswers.test.ts
 */
import {
  decodeAnswer, buildEnrichedComparison, verbatimChemistryHits,
  CHEMISTRY_VERBATIM_TERMS, estimateTokens, INPUT_TOKEN_CAP, questionMeta,
} from '../enrichedAnswers'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

// ═══ decoding ══════════════════════════════════════════════════════════════
eq(decodeAnswer('q12_conflict_resolution', 'space'), 'Take time to cool down first', 'short code decodes to its label')
eq(decodeAnswer('q12_conflict_resolution', 'Take time to cool down first'), 'Take time to cool down first', 'an exact option passes through')
eq(decodeAnswer('q9_intentions', ['lt', 'fwb']), 'Long-term partnership, Friends with benefits', 'arrays decode element-wise')
eq(decodeAnswer('q20_discretion', 3), '3', 'numeric Likert is kept as a number')
eq(decodeAnswer('q12_conflict_resolution', null), null, 'null -> null')
eq(decodeAnswer('q12_conflict_resolution', ''), null, 'empty -> null')

// ═══ THE ALLOWLIST — the load-bearing rule ═════════════════════════════════
// Production really contains free text that leaked into coded fields. A
// denylist would forward it to the model; an allowlist cannot.
eq(decodeAnswer('q28_hard_boundaries', 'Nothing involving scat or BDSM.'), null,
  'free text leaked into a coded field is DROPPED, not forwarded')
eq(decodeAnswer('q14b_cultural_identity', 'Libritarian leaning conservative'), null,
  'an unrecognised typed value is dropped')
eq(decodeAnswer('q9_intentions', ['lt', 'i want to meet someone near Dallas']), 'Long-term partnership',
  'a free-text element is dropped while its valid siblings survive')
eq(decodeAnswer('q12_conflict_resolution', 'wat'), null, 'an unknown code is dropped')

// ═══ free-text questions are dropped wholesale ═════════════════════════════
eq(decodeAnswer('q32_looking_for', 'Someone kind who lives in Austin'), null, 'q32_looking_for never decodes')
eq(decodeAnswer('q33_kinks', 'role'), null, 'q33_kinks is dropped even for a known code — it is a free-text field')

// ═══ the gate category never reaches the model ═════════════════════════════
const GATE = ['q1_age', 'q_race_identity', 'q_race_preference', 'q2_gender_identity', 'q2a_pronouns', 'q_age_min', 'q_age_max']
for (const g of GATE) {
  const meta = questionMeta(g)
  ok(!meta || meta.category === 'gate', `${g} is gate-category (or unmapped) — excluded by construction`)
}
{
  const viewer: Record<string, unknown> = { q1_age: '1988-07-23', q_race_identity: 'white', q2a_pronouns: 'she', q9_intentions: ['lt'] }
  const match: Record<string, unknown> = { q1_age: '1990-01-01', q_race_identity: 'asian', q2a_pronouns: 'he', q9_intentions: ['lt'] }
  const r = buildEnrichedComparison(viewer, match)
  ok(!/1988|1990/.test(r.block), 'no date of birth in the block')
  ok(!/white|asian/i.test(r.block), 'no race in the block')
  ok(!/\bshe\b|\bhe\b/.test(r.block.replace(/them|they/gi, '')), 'no pronouns in the block')
  ok(/Long-term partnership/.test(r.block), '...while the scoring answer IS present')
}

// ═══ children / family plans ARE included ══════════════════════════════════
{
  const r = buildEnrichedComparison({ Q17: 'dont' }, { Q17: 'want' })
  ok(/Doesn't have and doesn't want/.test(r.block), "viewer's children answer is included")
  ok(/Wants children/.test(r.block), "match's children answer is included")
}

// ═══ shape of the block ════════════════════════════════════════════════════
{
  const r = buildEnrichedComparison(
    { q9_intentions: ['lt'], q12_conflict_resolution: 'space' },
    { q9_intentions: ['lt', 'fwb'], q12_conflict_resolution: 'talk' }
  )
  ok(/\| you: .* \| them: /.test(r.block), 'each line carries both members, side by side')
  ok(r.block.includes('Goals & Expectations:'), 'rows are grouped under the display category name')
  ok(r.questionsIncluded >= 2, 'both answered questions are included')
  eq(r.tokens, estimateTokens(r.block), 'reported tokens match the rendered block')
}
{
  // Unanswered on BOTH sides is omitted entirely; one-sided shows "no answer",
  // which the prompt defines as UNKNOWN and forbids treating as a difference.
  const r = buildEnrichedComparison({ q9_intentions: ['lt'] }, {})
  ok(/no answer/.test(r.block), 'a one-sided answer renders "no answer" for the other side')
  ok(!/Which attachment style/.test(r.block), 'a question neither answered is omitted entirely')
}

// ═══ the token cap ═════════════════════════════════════════════════════════
{
  const big: Record<string, unknown> = {}
  for (const q of ['q9_intentions', 'q6_relationship_styles', 'q10_attachment_style', 'q12_conflict_resolution',
    'q11_love_languages', 'q23_erotic_styles', 'q24_experiences', 'q26_roles', 'q28_hard_boundaries',
    'q18_substances', 'q13a_languages', 'q19a_max_distance', 'q30_safer_sex', 'q31_health_testing']) big[q] = 'oth'
  const tight = buildEnrichedComparison(big, big, { tokenBudget: 60 })
  ok(tight.trimmed, 'a tight budget causes trimming')
  ok(tight.questionsIncluded < 14, `...and drops questions (kept ${tight.questionsIncluded} of 14)`)
  // The 5-row floor outranks the budget on purpose: an empty block puts us back
  // to engine-verdicts-only, which is the under-writing this module fixes.
  eq(tight.questionsIncluded, 5, 'trimming stops at the 5-row floor, even under budget pressure')
  ok(tight.tokens < 150, `the floor overrun is negligible against a 3,500 cap (${tight.tokens} tokens)`)
  const roomy = buildEnrichedComparison(big, big, { tokenBudget: 400 })
  ok(roomy.tokens <= 400, `a budget above the floor IS honoured (${roomy.tokens} <= 400)`)
  const loose = buildEnrichedComparison(big, big, { tokenBudget: 5000 })
  ok(loose.questionsIncluded >= tight.questionsIncluded, 'a loose budget keeps at least as much')
  ok(!loose.trimmed, 'a loose budget reports no trimming')
  eq(INPUT_TOKEN_CAP, 3500, 'the total input cap is the agreed 3,500')
}

// ═══ sexual-compatibility verbatim guard ═══════════════════════════════════
ok(CHEMISTRY_VERBATIM_TERMS.length > 15, 'the guard covers the disclosive terms')
for (const t of ['Threesomes', 'BDSM', 'Exhibitionism', 'Curious beginner', 'Athletic or fit'])
  ok(CHEMISTRY_VERBATIM_TERMS.includes(t), `"${t}" is guarded`)
eq(verbatimChemistryHits('They told us they are into BDSM and Threesomes.'), ['Threesomes', 'BDSM'],
  'a quoted practice is caught')
eq(verbatimChemistryHits('Your expectations around frequency differ somewhat.'), [],
  'ordinary analysis prose is clean')

// The terms deliberately NOT guarded, because they are ordinary English and a
// guard that fires on correct prose degrades whole cards for nothing.
for (const generic of ['Romantic', 'Experimental', 'Occasionally', 'Some experience', 'No preference', 'Several times a week'])
  ok(!CHEMISTRY_VERBATIM_TERMS.includes(generic), `"${generic}" is NOT guarded — too generic to match safely`)
eq(verbatimChemistryHits('You share a romantic, experimental streak and connect occasionally.'), [],
  'a sentence built only from the excluded generics is clean')

report('matches/enrichedAnswers')
