/**
 * Composition bucket logic. Run: npx tsx lib/metrics/__tests__/composition.test.ts
 *
 * The real bucketing lives in SQL (migration 045 get_composition_breakdown),
 * which cannot run without a DB. The functions below are a faithful TS MIRROR of
 * that SQL's rules — KEEP IN SYNC with migration 045. They document and test the
 * exact bucket boundaries against synthetic answers_json shapes.
 */
import { eq, report } from './_assert'

// ── Mirror of migration 045 SQL ──────────────────────────────────────────────

/** Mirrors: age(CURRENT_DATE, q1_age::date) → completed years → bracket. */
function ageBracket(birthdate: string | undefined | null, ref: Date): string {
  if (!birthdate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(birthdate)) return 'unknown'
  const [y, m, d] = birthdate.split('-').map(Number)
  let age = ref.getUTCFullYear() - y
  const month = ref.getUTCMonth() + 1
  const hadBirthday = month > m || (month === m && ref.getUTCDate() >= d)
  if (!hadBirthday) age--
  if (age < 18) return 'unknown' // data error / under-18
  if (age <= 24) return '18-24'
  if (age <= 34) return '25-34'
  if (age <= 44) return '35-44'
  if (age <= 54) return '45-54'
  return '55+'
}

/** Mirrors: COALESCE(NULLIF(LOWER(TRIM(x)), ''), 'unknown') for single-string dims. */
function normScalar(v: unknown): string {
  if (typeof v !== 'string') return 'unknown' // array/number/etc → unknown
  const t = v.trim().toLowerCase()
  return t === '' ? 'unknown' : t
}

/** Mirrors the q9_intentions array unnest + normalize. */
function normIntents(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((e) => normScalar(e))
  if (typeof v === 'string') return [normScalar(v)]
  return [] // absent → contributes nothing (not even 'unknown')
}

// ── Tests ────────────────────────────────────────────────────────────────────
const REF = new Date('2026-07-17T00:00:00.000Z')

// Age brackets at boundaries.
eq(ageBracket('2001-07-18', REF), '18-24', 'birthday tomorrow → still 24 → 18-24')
eq(ageBracket('2001-07-17', REF), '25-34', 'birthday today → 25 → 25-34')
eq(ageBracket('2008-07-17', REF), '18-24', 'exactly 18 → 18-24')
eq(ageBracket('2009-07-18', REF), 'unknown', 'age 16 (<18) → unknown')
eq(ageBracket('1991-07-17', REF), '35-44', 'age 35 → 35-44')
eq(ageBracket('1981-07-17', REF), '45-54', 'age 45 → 45-54')
eq(ageBracket('1971-07-17', REF), '55+', 'age 55 → 55+')
eq(ageBracket('1970-01-01', REF), '55+', 'age 56 → 55+')

// Age defensive: bad / missing / wrong-type.
eq(ageBracket('not-a-date', REF), 'unknown', 'non-date string → unknown')
eq(ageBracket('1990', REF), 'unknown', 'partial date → unknown')
eq(ageBracket(undefined, REF), 'unknown', 'missing → unknown')
eq(ageBracket(null, REF), 'unknown', 'null → unknown')

// Gender/orientation single-string normalization (casing drift from live data).
eq(normScalar('Man'), 'man', 'gender casing normalized')
eq(normScalar('Woman'), 'woman', 'gender casing normalized')
eq(normScalar('straight'), 'straight', 'orientation lowercased passthrough')
eq(normScalar('  Bi  '), 'bi', 'orientation trimmed + lowered')
eq(normScalar(''), 'unknown', 'empty string → unknown')
eq(normScalar(['man']), 'unknown', 'array where string expected → unknown (defensive)')
eq(normScalar(42), 'unknown', 'number where string expected → unknown')

// Relationship intent multi-select (array unnest); counts won't sum to total.
eq(normIntents(['lt', 'fwb', 'play']), ['lt', 'fwb', 'play'], 'array intents unnested')
eq(normIntents([' LT ', 'FWB']), ['lt', 'fwb'], 'intents trimmed + lowered')
eq(normIntents('lt'), ['lt'], 'lone-string intent accepted defensively')
eq(normIntents(['Long-term partnership']), ['long-term partnership'], 'legacy full-label kept, lowered')
eq(normIntents(undefined), [], 'absent intents contribute nothing')

report('composition')
