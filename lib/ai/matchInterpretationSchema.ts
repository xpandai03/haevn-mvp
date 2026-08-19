/**
 * Strict schema + validator for the AI match-interpretation JSON.
 *
 * The model returns ONE structured object per viewer→match direction. We validate
 * it hard: exactly five sections with the exact design category names, array
 * cardinalities, and non-empty required strings. A malformed response is REJECTED
 * (→ the caller degrades to deterministic section data), never rendered.
 *
 * `classification` is echoed by the model but IGNORED by the app — the UI always
 * renders its own `scoreToBand` output, so the AI can never alter a band.
 */

import { SECTION_DISPLAY_NAMES } from '@/lib/matches/sectionMapping'

export interface InterpretationSection {
  category: string
  classification: string
  overview: string
  alignments: string[]
  differences: string[]
  interpretation: string
}

export interface MatchInterpretation {
  match_summary: string
  executive_summary: string
  strongest_areas: Array<{ category: string; summary: string }>
  nudge_compatibility_highlights: string[]
  sections: InterpretationSection[]
  what_haevn_thinks_you_should_know: {
    strongest_reason: string
    most_meaningful_difference: string
    haevn_assessment: string
  }
  conversation_starters: string[]
}

export type ValidationResult =
  | { ok: true; value: MatchInterpretation }
  | { ok: false; errors: string[] }

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strArr = (v: unknown, cap: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, cap) : []

/**
 * Deterministic guard: an unanswered ("not specified") datum is UNKNOWN, never a
 * difference or alignment (AI-doc rule 5). We don't feed these strings to the
 * model, but this filter guarantees none survive even if the model invents one.
 */
const UNKNOWN_PHRASE = /not specified|unspecified|not answered|no data|not provided|not disclosed|unknown/i
const dropUnknowns = (v: unknown, cap: number): string[] =>
  strArr(v, cap + 3)
    .filter((s) => !UNKNOWN_PHRASE.test(s))
    .slice(0, cap)

/**
 * Validate + NORMALIZE a parsed interpretation.
 *
 * HARD-fail only on what would break the render: not an object; the five sections
 * missing/miscounted/mis-named or missing overview; the required prose fields
 * (match_summary, executive_summary, strongest_reason, haevn_assessment); < 3
 * strongest_areas or conversation_starters. Everything the AI doc marks omittable
 * — `interpretation` ("omit if nothing useful"), `differences`/`alignments`
 * ("[] if none"), `classification` (echoed, app ignores), `most_meaningful_difference`,
 * and the nudge teaser — is COERCED to a safe default, never rejected. This keeps
 * a doc-compliant response (which legitimately omits a field) from spuriously
 * degrading a whole card. Length limits are soft (not enforced here).
 */
export function validateMatchInterpretation(obj: unknown): ValidationResult {
  const errors: string[] = []
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['not an object'] }
  const o = obj as Record<string, unknown>

  if (!isNonEmptyString(o.match_summary)) errors.push('match_summary missing/empty')
  if (!isNonEmptyString(o.executive_summary)) errors.push('executive_summary missing/empty')

  // strongest_areas — need at least 3 usable {category, summary}; take the first 3.
  const rawAreas = Array.isArray(o.strongest_areas) ? o.strongest_areas : []
  const areas = rawAreas
    .map((a) => a as Record<string, unknown>)
    .filter((a) => isNonEmptyString(a?.category) && isNonEmptyString(a?.summary))
    .slice(0, 3)
    .map((a) => ({ category: a.category as string, summary: a.summary as string }))
  if (areas.length < 3) errors.push('strongest_areas needs 3 usable {category, summary} items')

  // sections — exactly 5, exact names + overview are hard; the rest coerces.
  const rawSections = Array.isArray(o.sections) ? o.sections : []
  const sections: MatchInterpretation['sections'] = []
  if (rawSections.length !== 5) {
    errors.push('sections must have exactly 5 items')
  } else {
    rawSections.forEach((s, i) => {
      const sec = s as Record<string, unknown>
      const expected = SECTION_DISPLAY_NAMES[i]
      if (sec?.category !== expected) errors.push(`sections[${i}].category must be "${expected}" (got "${String(sec?.category)}")`)
      if (!isNonEmptyString(sec?.overview)) errors.push(`sections[${i}].overview missing`)
      sections.push({
        category: expected,
        classification: typeof sec?.classification === 'string' ? sec.classification : '',
        overview: typeof sec?.overview === 'string' ? sec.overview : '',
        alignments: dropUnknowns(sec?.alignments, 3),
        differences: dropUnknowns(sec?.differences, 2),
        interpretation: typeof sec?.interpretation === 'string' ? sec.interpretation : '', // omit is valid
      })
    })
  }

  // synthesis
  const w = (o.what_haevn_thinks_you_should_know ?? {}) as Record<string, unknown>
  if (typeof w !== 'object') errors.push('what_haevn_thinks_you_should_know missing')
  if (!isNonEmptyString(w.strongest_reason)) errors.push('what_haevn…strongest_reason missing')
  if (!isNonEmptyString(w.haevn_assessment)) errors.push('what_haevn…haevn_assessment missing')

  // conversation starters — need at least 3; keep up to 5.
  const starters = strArr(o.conversation_starters, 5)
  if (starters.length < 3) errors.push('conversation_starters needs at least 3 strings')

  if (errors.length) return { ok: false, errors }

  const value: MatchInterpretation = {
    match_summary: o.match_summary as string,
    executive_summary: o.executive_summary as string,
    strongest_areas: areas,
    nudge_compatibility_highlights: strArr(o.nudge_compatibility_highlights, 3),
    sections,
    what_haevn_thinks_you_should_know: {
      strongest_reason: w.strongest_reason as string,
      most_meaningful_difference: typeof w.most_meaningful_difference === 'string' ? w.most_meaningful_difference : '',
      haevn_assessment: w.haevn_assessment as string,
    },
    conversation_starters: starters,
  }
  return { ok: true, value }
}
