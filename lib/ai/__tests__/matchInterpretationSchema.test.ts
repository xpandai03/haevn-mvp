/**
 * Interpretation schema validation + degradation contract.
 * Run: npx tsx lib/ai/__tests__/matchInterpretationSchema.test.ts
 *
 * A valid object passes; every structural violation returns ok:false so the
 * caller degrades to deterministic section data instead of rendering bad copy.
 */
import { validateMatchInterpretation } from '../matchInterpretationSchema'
import { SECTION_DISPLAY_NAMES } from '../../matches/sectionMapping'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

function validSection(name: string) {
  return {
    category: name,
    classification: 'Strong Alignment',
    overview: 'You both value intentional connection and communicate in similar, direct ways.',
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

report('ai/matchInterpretationSchema')
