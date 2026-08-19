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
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/**
 * Validate a parsed object against the interpretation contract. Returns typed
 * value on success or a list of human-readable errors on failure. Length limits
 * from the AI doc are checked as SOFT warnings (logged, not rejected) so a
 * slightly-long sentence never blanks a card; structural violations are hard.
 */
export function validateMatchInterpretation(obj: unknown): ValidationResult {
  const errors: string[] = []
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['not an object'] }
  const o = obj as Record<string, unknown>

  if (!isNonEmptyString(o.match_summary)) errors.push('match_summary missing/empty')
  if (!isNonEmptyString(o.executive_summary)) errors.push('executive_summary missing/empty')

  // strongest_areas — exactly 3 {category, summary}
  if (!Array.isArray(o.strongest_areas) || o.strongest_areas.length !== 3) {
    errors.push('strongest_areas must have exactly 3 items')
  } else {
    o.strongest_areas.forEach((a, i) => {
      const it = a as Record<string, unknown>
      if (!isNonEmptyString(it?.category)) errors.push(`strongest_areas[${i}].category missing`)
      if (!isNonEmptyString(it?.summary)) errors.push(`strongest_areas[${i}].summary missing`)
    })
  }

  // nudge highlights — exactly 3 strings (rendered only in nudged state)
  if (!isStringArray(o.nudge_compatibility_highlights) || o.nudge_compatibility_highlights.length !== 3) {
    errors.push('nudge_compatibility_highlights must be 3 strings')
  }

  // sections — exactly 5, exact category names, in order
  if (!Array.isArray(o.sections) || o.sections.length !== 5) {
    errors.push('sections must have exactly 5 items')
  } else {
    o.sections.forEach((s, i) => {
      const sec = s as Record<string, unknown>
      const expected = SECTION_DISPLAY_NAMES[i]
      if (sec?.category !== expected) errors.push(`sections[${i}].category must be "${expected}" (got "${String(sec?.category)}")`)
      if (!isNonEmptyString(sec?.overview)) errors.push(`sections[${i}].overview missing`)
      if (!isStringArray(sec?.alignments) || (sec.alignments as string[]).length > 3)
        errors.push(`sections[${i}].alignments must be ≤3 strings`)
      if (!isStringArray(sec?.differences) || (sec.differences as string[]).length > 2)
        errors.push(`sections[${i}].differences must be ≤2 strings`)
      if (typeof sec?.interpretation !== 'string') errors.push(`sections[${i}].interpretation must be a string`)
      if (typeof sec?.classification !== 'string') errors.push(`sections[${i}].classification must be a string`)
    })
  }

  // synthesis
  const w = o.what_haevn_thinks_you_should_know as Record<string, unknown> | undefined
  if (!w || typeof w !== 'object') {
    errors.push('what_haevn_thinks_you_should_know missing')
  } else {
    if (!isNonEmptyString(w.strongest_reason)) errors.push('what_haevn…strongest_reason missing')
    if (typeof w.most_meaningful_difference !== 'string') errors.push('what_haevn…most_meaningful_difference must be a string')
    if (!isNonEmptyString(w.haevn_assessment)) errors.push('what_haevn…haevn_assessment missing')
  }

  // conversation starters — 3–5
  if (!isStringArray(o.conversation_starters) || o.conversation_starters.length < 3 || o.conversation_starters.length > 5) {
    errors.push('conversation_starters must be 3–5 strings')
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, value: obj as unknown as MatchInterpretation }
}
