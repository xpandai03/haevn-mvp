/**
 * Interpretation schema validation + degradation contract.
 * Run: npx tsx lib/ai/__tests__/matchInterpretationSchema.test.ts
 *
 * A valid object passes; every structural violation returns ok:false so the
 * caller degrades to deterministic section data instead of rendering bad copy.
 */
import { validateMatchInterpretation, chipViolations } from '../matchInterpretationSchema'
import { SECTION_DISPLAY_NAMES, verdictForScore } from '../../matches/sectionMapping'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

function validSection(name: string) {
  return {
    category: name,
    classification: 'Strong Alignment',
    overview: 'You both value intentional connection and communicate in similar, direct ways.',
    your_alignment: 'You and this person both described wanting a committed, long-term relationship, and your answers around pace and priorities line up closely across the questions HAEVN weighs most heavily in this category.',
    where_you_differ: 'The differences here are modest. You indicated slightly more urgency around timing, while their responses suggest a steadier pace, though neither answer points away from the same destination.',
    alignments: ['Shared long-term intent'],
    differences: [],
    interpretation: 'This suggests day-to-day expectations are likely to line up well.',
  }
}
function validInterp() {
  return {
    match_summary: 'You align on the kind of relationship you want and how you like to communicate.',
    executive_summary: 'HAEVN matched you on strong shared intent and communication, with broadly compatible lifestyles and one area worth a conversation.',
    strongest_areas: [
      { category: 'Goals & Expectations', summary: 'You both want a long-term partner.' },
      { category: 'Emotional & Communication', summary: 'You communicate in remarkably similar ways.' },
      { category: 'Structure Fit', summary: 'Aligned on monogamy and commitment.' },
    ],
    nudge_compatibility_highlights: ['Aligned long-term goals', 'Similar communication style', 'Compatible pace'],
    sections: SECTION_DISPLAY_NAMES.map(validSection),
    what_haevn_thinks_you_should_know: {
      strongest_reason: 'You want the same kind of relationship and approach connection similarly.',
      most_meaningful_difference: 'Preferences around intimacy differ somewhat and are worth discussing.',
      haevn_assessment: 'This is a promising match with strong alignment in the areas that most shape healthy, lasting relationships. You share relationship intent, communication style, and practical rhythms. The clearest difference is around intimacy expectations, which is worth an open conversation rather than a dealbreaker. No major incompatibility was identified in the available responses.',
    },
    conversation_starters: ['How each of you likes to handle conflict', 'What a fulfilling long-term relationship looks like', 'Expectations around time together vs personal space'],
    why_this_introduction: {
      what_aligns: 'You are both looking for a committed relationship and described compatible expectations around how a partnership should actually operate day to day, which is the strongest shared foundation HAEVN looks for.',
      what_differs: 'Your expectations around personal space and the rhythm of intimacy are not identical, and those differences are real rather than cosmetic, though neither crossed the threshold HAEVN treats as incompatible.',
      the_verdict: 'Enough genuine alignment to justify the introduction, with enough difference that getting to know each other still matters.',
    },
    worth_talking_about: {
      items: ['How much independent time each of you needs', 'Your preferred rhythm around intimacy', 'How quickly you like to resolve disagreements'],
      closing: 'These are not dealbreakers. They are the areas where understanding each other early is likely to matter most.',
    },
    signals_that_mattered: ['Long-term intent', 'Monogamous structure', 'Direct communication', 'Compatible intimacy expectations', 'Similar lifestyle rhythm', 'Shared priorities'],
    closing_read: {
      verdict: 'INTRODUCTION RECOMMENDED',
      statement: 'Strong shared intent and relationship structure, with meaningful compatibility across all five areas. A few differences are worth exploring, but none outweigh the reasons to meet.',
    },
  }
}

// ── valid ──
{
  const r = validateMatchInterpretation(validInterp())
  ok(r.ok, 'valid interpretation passes')
}

// ── structural violations → ok:false (degrade) ──
const bad = (mut: (o: any) => void, msg: string) => {
  const o = validInterp()
  mut(o)
  const r = validateMatchInterpretation(o)
  ok(!r.ok, msg)
}
bad((o) => (o.match_summary = ''), 'empty match_summary rejected')
bad((o) => (o.sections = o.sections.slice(0, 4)), '4 sections rejected')
bad((o) => (o.sections[3].category = 'Bedroom Vibes'), 'wrong section category name rejected')
bad((o) => (o.sections[0].overview = ''), 'empty section overview rejected')
bad((o) => (o.strongest_areas = o.strongest_areas.slice(0, 2)), '<3 strongest_areas rejected')
bad((o) => (o.conversation_starters = ['one', 'two']), '<3 conversation_starters rejected')
bad((o) => delete o.what_haevn_thinks_you_should_know, 'missing synthesis rejected')
bad((o) => (o.what_haevn_thinks_you_should_know.haevn_assessment = ''), 'empty haevn_assessment rejected')
eq(validateMatchInterpretation(null).ok, false, 'null rejected')
eq(validateMatchInterpretation('{}' as unknown).ok, false, 'string rejected')

// ── COERCION: doc-omittable fields must NOT reject (the bug the real samples caught) ──
{
  const o: any = validInterp()
  delete o.sections[4].interpretation // model legitimately omits "if nothing useful"
  const r = validateMatchInterpretation(o)
  ok(r.ok, 'omitted section.interpretation is coerced, not rejected')
  if (r.ok) eq(r.value.sections[4].interpretation, '', 'omitted interpretation → ""')
}
{
  const o: any = validInterp()
  delete o.sections[0].differences
  delete o.sections[0].alignments
  const r = validateMatchInterpretation(o)
  ok(r.ok, 'omitted differences/alignments coerced to []')
  if (r.ok) eq(r.value.sections[0].differences, [], 'omitted differences → []')
}
{
  const o: any = validInterp()
  o.sections[0].alignments = ['a', 'b', 'c', 'd', 'e']
  o.sections[0].differences = ['x', 'y', 'z']
  const r = validateMatchInterpretation(o)
  ok(r.ok, 'over-cap alignments/differences coerced, not rejected')
  if (r.ok) {
    eq(r.value.sections[0].alignments.length, 3, 'alignments capped to 3')
    eq(r.value.sections[0].differences.length, 2, 'differences capped to 2')
  }
}
{
  const o: any = validInterp()
  delete o.nudge_compatibility_highlights
  const r = validateMatchInterpretation(o)
  ok(r.ok, 'omitted nudge highlights coerced to [] (only rendered in nudged state)')
}
{
  const o: any = validInterp()
  o.strongest_areas = [...o.strongest_areas, { category: 'Practical Fit', summary: 'extra' }]
  const r = validateMatchInterpretation(o)
  ok(r.ok && r.value.strongest_areas.length === 3, '4 strongest_areas → sliced to 3')
}

// ── DETERMINISTIC unknowns filter: "not specified" never survives as a difference ──
{
  const o: any = validInterp()
  o.sections[4].differences = ['Lifestyle importance not specified', 'Different schedules']
  o.sections[4].alignments = ['Cultural preferences unspecified', 'Compatible privacy levels']
  const r = validateMatchInterpretation(o)
  ok(r.ok, 'unknown-phrased entries do not fail validation')
  if (r.ok) {
    eq(r.value.sections[4].differences, ['Different schedules'], 'unknown-phrased difference stripped, real one kept')
    eq(r.value.sections[4].alignments, ['Compatible privacy levels'], 'unknown-phrased alignment stripped, real one kept')
  }
}

// ═══ v2: new HARD-FAILS ═══════════════════════════════════════════════════
bad((o) => delete o.why_this_introduction, 'missing why_this_introduction rejected')
bad((o) => (o.why_this_introduction.what_aligns = ''), 'empty why_this_introduction.what_aligns rejected')
bad((o) => (o.why_this_introduction.what_differs = ''), 'empty what_differs rejected')
bad((o) => (o.why_this_introduction.the_verdict = ''), 'empty the_verdict rejected')
bad((o) => (o.sections[2].your_alignment = ''), 'empty section.your_alignment rejected')
bad((o) => delete o.sections[2].where_you_differ, 'missing section.where_you_differ rejected')
bad((o) => (o.worth_talking_about.items = ['only', 'two']), '2 worth_talking_about items rejected')
bad((o) => (o.worth_talking_about.items = ['a', 'b', 'c', 'd']), '4 worth_talking_about items rejected')
bad((o) => delete o.worth_talking_about, 'missing worth_talking_about rejected')
bad((o) => (o.signals_that_mattered = o.signals_that_mattered.slice(0, 5)), '5 signal chips rejected (must be exactly 6)')
bad((o) => (o.signals_that_mattered = [...o.signals_that_mattered, 'Extra chip']), '7 signal chips rejected')
bad((o) => (o.closing_read.statement = ''), 'empty closing_read.statement rejected')
bad((o) => delete o.closing_read, 'missing closing_read rejected')

// An unknown must never be rendered as a finding in the two prose fields.
bad((o) => (o.sections[1].where_you_differ = 'Their exclusivity preference was not specified, so this differs.'),
  'where_you_differ asserting an unknown is rejected')
bad((o) => (o.sections[1].your_alignment = 'Their exclusivity preference was not provided, which aligns with yours.'),
  'your_alignment asserting an unanswered signal is rejected')

// ...but honest disclosure of PARTIAL COVERAGE must still pass. This exact
// sentence came out of a real generation and used to degrade the whole card:
// blocking it is worse for the member than the sentence it was meant to prevent.
{
  const o: any = validInterp()
  o.sections[4].where_you_differ =
    'Limited data on practical aspects means there may be unknowns worth exploring together, though nothing in the answers you both gave points to a conflict in how you run your weeks.'
  const r = validateMatchInterpretation(o)
  ok(r.ok, 'a "limited data / unknowns" coverage caveat is ALLOWED — it manufactures nothing')
}

// ═══ v2: §05 CHIP CONSTRAINT — the free-viewer leak ═══════════════════════
// The client's own sample contains "Austin-based". It must never validate.
{
  const o: any = validInterp()
  o.signals_that_mattered[4] = 'Austin-based'
  const r = validateMatchInterpretation(o, { forbiddenCityTokens: ['Austin', 'Portland'] })
  ok(!r.ok, 'a "<City>-based" chip HARD-FAILS — this is the reference page\'s own leak')
  if (!r.ok) ok(r.errors.some((e) => /signals_that_mattered\[4\]/.test(e)), '...and the error names the offending chip')
}
{
  const o: any = validInterp()
  o.signals_that_mattered[0] = 'Both in Portland'
  const r = validateMatchInterpretation(o, { forbiddenCityTokens: ['Austin', 'Portland'] })
  ok(!r.ok, 'a bare city name in a chip hard-fails')
}
{
  const o: any = validInterp()
  o.signals_that_mattered[1] = 'Lives nearby'
  ok(!validateMatchInterpretation(o).ok, 'a proximity chip hard-fails even with no city list')
}
{
  const o: any = validInterp()
  o.signals_that_mattered[2] = 'Same age bracket'
  ok(!validateMatchInterpretation(o).ok, 'a demographic chip hard-fails')
}
{
  const o: any = validInterp()
  o.signals_that_mattered[3] = 'Works at the same company'
  ok(!validateMatchInterpretation(o).ok, 'an employer chip hard-fails')
}
// The five legitimate reference chips must all still pass.
for (const good of ['Long-term intent', 'Monogamous structure', 'Direct communication', 'Compatible intimacy expectations', 'Similar lifestyle rhythm']) {
  eq(chipViolations(good, ['Austin', 'Portland']), [], `legitimate chip "${good}" is clean`)
}
// A short city token must not false-positive on ordinary words.
eq(chipViolations('Direct communication', ['NY']), [], 'a 2-char city token is ignored, not matched into prose')

// ═══ v2: COERCIONS ════════════════════════════════════════════════════════
{
  const o: any = validInterp()
  delete o.worth_talking_about.closing
  const r = validateMatchInterpretation(o)
  ok(r.ok, 'omitted worth_talking_about.closing is coerced, not rejected')
  if (r.ok) eq(r.value.worth_talking_about.closing, '', 'omitted closing → ""')
}
{
  // The model's verdict echo is ALWAYS discarded in favour of the code value.
  const o: any = validInterp()
  o.closing_read.verdict = 'ABSOLUTELY GO FOR IT'
  const r = validateMatchInterpretation(o, { verdict: 'INTRODUCTION WORTH CONSIDERING' })
  ok(r.ok, 'an invented verdict does not reject — it is overwritten')
  if (r.ok) eq(r.value.closing_read.verdict, 'INTRODUCTION WORTH CONSIDERING', 'code-derived verdict wins over the model echo')
}
{
  const o: any = validInterp()
  const r = validateMatchInterpretation(o)
  if (r.ok) eq(r.value.closing_read.verdict, 'INTRODUCTION RECOMMENDED', 'absent opts → documented default verdict')
}

// ═══ v2: verdict derivation is a closed set driven by the band ════════════
eq(verdictForScore(95), 'INTRODUCTION STRONGLY RECOMMENDED', '95 → strongly recommended')
eq(verdictForScore(84), 'INTRODUCTION RECOMMENDED', '84 (the reference score) → recommended')
eq(verdictForScore(80), 'INTRODUCTION RECOMMENDED', '80 → recommended (band boundary)')
eq(verdictForScore(77), 'INTRODUCTION WORTH CONSIDERING', '77 (the live median) → worth considering')
eq(verdictForScore(65), 'INTRODUCTION WITH RESERVATIONS', '65 → with reservations')
eq(verdictForScore(40), 'INTRODUCTION WITH RESERVATIONS', 'low scores share the most reserved verdict, never a refusal')

report('ai/matchInterpretationSchema')
