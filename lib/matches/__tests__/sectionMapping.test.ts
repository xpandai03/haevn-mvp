/**
 * Section mapping + bands. Run: npx tsx lib/matches/__tests__/sectionMapping.test.ts
 */
import { SECTIONS, scoreToBand, overallBadge, parseSections } from '../sectionMapping'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── section identity: engine order + names ──
eq(SECTIONS.map((s) => s.engineCategory).join(','), 'intent,structure,connection,chemistry,lifestyle', 'engine order')
eq(
  SECTIONS.map((s) => s.displayName).join(' | '),
  'Goals & Expectations | Structure Fit | Emotional & Communication | Sexual Compatibility | Practical Fit',
  'design section names, in order',
)

// ── band boundaries ──
eq(scoreToBand(100).label, 'Fully Aligned', '100 -> Fully Aligned (special case)')
eq(scoreToBand(100).band, 'exceptional', '100 is exceptional band')
eq(scoreToBand(96).label, 'Exceptional Alignment', '96 -> Exceptional Alignment')
eq(scoreToBand(90).band, 'exceptional', '90 boundary -> exceptional')
eq(scoreToBand(89).band, 'strong', '89 -> strong')
eq(scoreToBand(80).band, 'strong', '80 boundary -> strong')
eq(scoreToBand(79).band, 'compatible', '79 -> compatible')
eq(scoreToBand(79).label, 'Compatible', '70–79 label is "Compatible"')
eq(scoreToBand(70).band, 'compatible', '70 boundary -> compatible')
eq(scoreToBand(69).band, 'some_differences', '69 -> some_differences')
eq(scoreToBand(60).band, 'some_differences', '60 boundary -> some_differences')
eq(scoreToBand(59).band, 'meaningful_difference', '59 -> meaningful_difference')
eq(scoreToBand(0).band, 'meaningful_difference', '0 -> meaningful_difference')

// ── overall badge: five-band vocab governs (92 -> EXCEPTIONAL, not STRONG) ──
eq(overallBadge(92).label, 'EXCEPTIONAL MATCH', '92 -> EXCEPTIONAL MATCH (locked decision)')
eq(overallBadge(85).label, 'STRONG MATCH', '85 -> STRONG MATCH')
eq(overallBadge(77).label, 'COMPATIBLE MATCH', '77 -> COMPATIBLE MATCH')

// ── parseSections from a raw engine breakdown array ──
{
  const raw = [
    { category: 'intent', score: 93, coverage: 0.87, subScores: [{ key: 'goals', score: 100, reason: 'Shared goals: 100% alignment', matched: true }] },
    { category: 'structure', score: 59, coverage: 0.9, subScores: [{ key: 'boundaries', score: 25, reason: 'Different boundary approaches', matched: true }] },
    { category: 'connection', score: 74, coverage: 0.8, subScores: [] },
    { category: 'chemistry', score: 53, coverage: 0.6, subScores: [] },
    // lifestyle intentionally MISSING → must still appear, score 0, coverage null
  ]
  const s = parseSections(raw)
  eq(s.length, 5, 'always exactly 5 sections')
  eq(s.map((x) => x.displayName).join(','), 'Goals & Expectations,Structure Fit,Emotional & Communication,Sexual Compatibility,Practical Fit', 'ordered by engine')
  eq(s[0].score, 93, 'intent score carried')
  eq(s[0].band.label, 'Exceptional Alignment', 'intent 93 banded')
  eq(s[1].band.band, 'meaningful_difference', 'structure 59 -> meaningful_difference')
  eq(s[0].subScores[0].reason, 'Shared goals: 100% alignment', 'engine reason carried through')
  eq(s[4].score, 0, 'missing lifestyle -> score 0 (not dropped)')
  eq(s[4].coverage, null, 'missing lifestyle -> null coverage')
  ok(parseSections(null).length === 5, 'null breakdown still yields 5 sections')
}

report('matches/sectionMapping')
