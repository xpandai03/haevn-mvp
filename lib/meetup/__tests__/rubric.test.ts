/**
 * Meetup rubric v1. Run: npx tsx lib/meetup/__tests__/rubric.test.ts
 *
 * Locks: baseline trio always qualifies; alcohol shares ONE gate but emits three
 * DISTINCT categories; sobriety on either side excludes alcohol; hotels never
 * emitted; q16a is not consulted.
 */
import { qualifyCategories, type MemberRubricSignals } from '../rubric'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const cats = (list: ReturnType<typeof qualifyCategories>) => list.map((c) => c.category);
const conf = (list: ReturnType<typeof qualifyCategories>, c: string) =>
  list.find((x) => x.category === c)?.confidence;
const M = (alcohol: MemberRubricSignals['alcohol'], socialEnergy: number | null): MemberRubricSignals => ({
  alcohol,
  socialEnergy,
});

// ── both alcohol-positive + both socially energetic ──
{
  const r = qualifyCategories(M('positive', 5), M('positive', 4))
  ok(cats(r).includes('coffee') && cats(r).includes('restaurant') && cats(r).includes('activity'), 'baseline trio present')
  eq(conf(r, 'coffee'), 'high', 'coffee always high')
  eq(conf(r, 'restaurant'), 'high', 'restaurant always high')
  eq(conf(r, 'activity'), 'high', 'both energetic -> activity high')
  ok(
    cats(r).includes('cocktail_bar') && cats(r).includes('wine_bar') && cats(r).includes('brewery'),
    'alcohol group emits three DISTINCT categories',
  )
  eq(conf(r, 'cocktail_bar'), 'normal', 'both positive -> alcohol normal')
  eq(conf(r, 'wine_bar'), 'normal', 'wine_bar shares the confidence')
  ok(!(cats(r) as string[]).includes('hotel'), 'hotel never emitted in v1')
  eq(r.length, 6, 'exactly 6 categories (3 baseline + 3 alcohol)')
}

// ── sober on one side -> alcohol group EXCLUDED entirely ──
{
  const r = qualifyCategories(M('sober', 3), M('positive', 3))
  eq(cats(r).sort().join(','), 'activity,coffee,restaurant', 'sober excludes all alcohol venues')
  ok(!cats(r).some((c) => ['cocktail_bar', 'wine_bar', 'brewery'].includes(c)), 'no alcohol category when a side is sober')
}

// ── one unknown, neither sober -> low_confidence alcohol ──
{
  const r = qualifyCategories(M('positive', 2), M('unknown', 2))
  eq(conf(r, 'cocktail_bar'), 'low_confidence', 'unknown side -> alcohol low_confidence')
  eq(conf(r, 'brewery'), 'low_confidence', 'brewery low_confidence too')
}

// ── both positive but low social energy -> activity normal ──
{
  const r = qualifyCategories(M('positive', 2), M('positive', 3))
  eq(conf(r, 'activity'), 'normal', 'not both energetic -> activity normal')
  eq(conf(r, 'cocktail_bar'), 'normal', 'both positive -> alcohol still normal')
}

// ── missing social energy -> activity normal, never crashes ──
{
  const r = qualifyCategories(M('unknown', null), M('unknown', null))
  eq(conf(r, 'activity'), 'normal', 'null social energy -> activity normal')
  eq(conf(r, 'cocktail_bar'), 'low_confidence', 'both unknown -> alcohol low_confidence (not excluded)')
}

report('meetup/rubric')
