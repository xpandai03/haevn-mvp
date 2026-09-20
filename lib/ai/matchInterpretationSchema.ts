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
 * `closing_read.verdict` works the same way: derived in code, echoed by the model,
 * overwritten here.
 *
 * ── SCHEMA v2 (the full match report) ───────────────────────────────────────
 * v2 adds the fields the public sample report at haevn.co/match-example requires
 * and v1 had no slot for: §02's three paragraphs, per-category prose for
 * `YOUR ALIGNMENT` / `WHERE YOU DIFFER`, §04 Worth Talking About, §05 The Signals
 * That Mattered, and the closing verdict strip.
 *
 * `alignments[]` / `differences[]` are DELIBERATELY KEPT alongside the new prose
 * fields for one release. They still back the list/nudge surfaces, and keeping
 * both means a v2 rollback needs no data migration. Drop them once the report UI
 * is the only consumer.
 *
 * Static per-category copy (WHAT THIS MEASURES / WHY IT MATTERS) is NOT here and
 * never reaches the model — see lib/matches/categoryCopy.ts.
 */

import { SECTION_DISPLAY_NAMES, type ClosingVerdict } from '@/lib/matches/sectionMapping'

export type { ClosingVerdict }

export interface InterpretationSection {
  category: string
  classification: string
  overview: string
  /** v2 — "YOUR ALIGNMENT" prose. */
  your_alignment: string
  /** v2 — "WHERE YOU DIFFER" prose. */
  where_you_differ: string
  interpretation: string
  /** v1, retained one release for the list/nudge surfaces. */
  alignments: string[]
  /** v1, retained one release. */
  differences: string[]
}

export interface MatchInterpretation {
  match_summary: string
  executive_summary: string
  /** v2 — §02, three paragraphs. */
  why_this_introduction: {
    what_aligns: string
    what_differs: string
    the_verdict: string
  }
  strongest_areas: Array<{ category: string; summary: string }>
  nudge_compatibility_highlights: string[]
  sections: InterpretationSection[]
  /** v2 — §04. */
  worth_talking_about: {
    items: string[]
    closing: string
  }
  /** v2 — §05, exactly 6 chips. */
  signals_that_mattered: string[]
  what_haevn_thinks_you_should_know: {
    strongest_reason: string
    most_meaningful_difference: string
    haevn_assessment: string
  }
  conversation_starters: string[]
  /** v2 — closing verdict strip. */
  closing_read: {
    verdict: ClosingVerdict
    statement: string
  }
}

export type ValidationResult =
  | { ok: true; value: MatchInterpretation }
  | { ok: false; errors: string[] }

export interface ValidateOpts {
  /**
   * Verdict derived in code from the overall band. The model's echo is discarded
   * in favour of this. Defaults to the neutral middle value.
   */
  verdict?: ClosingVerdict
  /**
   * City strings that must never appear in a §05 chip — at minimum the two
   * members' cities. Matching is case-insensitive and word-boundary aware.
   * See SIGNAL CHIP CONSTRAINT below.
   */
  forbiddenCityTokens?: string[]
}

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
 * A prose field must not present MISSING DATA AS A FINDING — but it may honestly
 * disclose that coverage is partial.
 *
 * NARROWER THAN UNKNOWN_PHRASE ON PURPOSE, and the difference is load-bearing.
 * The phrases below are the engine's own "not specified" reason strings; seeing
 * one inside prose means the model parroted an unanswered signal into a finding,
 * which is the thing AI-doc rule 5 forbids. The bare word "unknown" is NOT in
 * this list: a real generated sample read
 *
 *   "Limited data on practical aspects means there may be unknowns worth
 *    exploring together."
 *
 * — which is exactly the "limited data" framing the prompt asks for, and
 * rejecting it degraded the whole card. Blocking honest disclosure of partial
 * coverage is worse for the member than the sentence it was trying to prevent.
 */
const UNKNOWN_AS_FINDING = /not specified|unspecified|not answered|not provided|not disclosed|no data/i
const assertsUnknown = (s: string): boolean => UNKNOWN_AS_FINDING.test(s)

// ─── SIGNAL CHIP CONSTRAINT (§05) ───────────────────────────────────────────
/**
 * §05 "The Signals That Mattered" renders short chips, and that section is
 * VISIBLE TO FREE VIEWERS. The client's own sample includes the chip
 * "Austin-based" — a location chip inside a free-visible section leaks exactly
 * the geography the report header deliberately bands, and re-identifies a member
 * in a thin market far more effectively than a name would.
 *
 * So chips are constrained to the five engine categories and may never carry
 * location, employer, or demographics. A violating chip HARD-FAILS the whole
 * payload rather than being silently dropped: a six-chip section that silently
 * becomes five is a UI bug, and more importantly a model that produced one
 * location chip is not one whose other five we should trust to be clean. Failing
 * degrades the card to deterministic sections, which is the safe direction.
 */
const CHIP_FORBIDDEN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /-\s*based\b/i, label: 'location ("-based")' },
  { re: /\b(miles?|km|kilometers?)\b/i, label: 'distance' },
  { re: /\b(nearby|local|same city|same area|same metro|cross-?city|lives? in|based in)\b/i, label: 'location' },
  { re: /\b(works? at|employed|employer|job title|same industry|colleague)\b/i, label: 'employer' },
  { re: /\b(same age|age gap|years old|similar age|both men|both women|same gender|same orientation)\b/i, label: 'demographics' },
  { re: /\b[A-Z]{2}\b(?=\s*$)/, label: 'state abbreviation' },
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Reasons a chip is rejected; empty array = clean. */
export function chipViolations(chip: string, forbiddenCityTokens: string[] = []): string[] {
  const out: string[] = []
  for (const { re, label } of CHIP_FORBIDDEN_PATTERNS) if (re.test(chip)) out.push(label)
  for (const city of forbiddenCityTokens) {
    const t = String(city ?? '').trim()
    if (t.length < 3) continue // "NY" etc. would false-positive on ordinary words
    if (new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(chip)) out.push(`city name ("${t}")`)
  }
  return [...new Set(out)]
}

/**
 * Validate + NORMALIZE a parsed interpretation.
 *
 * HARD-fail only on what would break the render or breach a contract: not an
 * object; the five sections missing/miscounted/mis-named or missing overview /
 * your_alignment / where_you_differ; the required prose fields; < 3
 * strongest_areas or conversation_starters; the three why_this_introduction
 * paragraphs; exactly 3 worth_talking_about.items; exactly 6 clean
 * signals_that_mattered; closing_read.statement.
 *
 * Everything the AI doc marks omittable — `interpretation` ("omit if nothing
 * useful"), `differences`/`alignments` ("[] if none"), `classification` (echoed,
 * app ignores), `most_meaningful_difference`, the nudge teaser, and
 * `worth_talking_about.closing` — is COERCED to a safe default, never rejected.
 * `closing_read.verdict` is likewise overwritten with the code-derived value.
 */
export function validateMatchInterpretation(obj: unknown, opts: ValidateOpts = {}): ValidationResult {
  const errors: string[] = []
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['not an object'] }
  const o = obj as Record<string, unknown>
  const forbiddenCities = opts.forbiddenCityTokens ?? []

  if (!isNonEmptyString(o.match_summary)) errors.push('match_summary missing/empty')
  if (!isNonEmptyString(o.executive_summary)) errors.push('executive_summary missing/empty')

  // ── v2: §02 three paragraphs ──
  const why = (o.why_this_introduction ?? {}) as Record<string, unknown>
  for (const k of ['what_aligns', 'what_differs', 'the_verdict'] as const) {
    if (!isNonEmptyString(why[k])) errors.push(`why_this_introduction.${k} missing/empty`)
  }

  // strongest_areas — need at least 3 usable {category, summary}; take the first 3.
  const rawAreas = Array.isArray(o.strongest_areas) ? o.strongest_areas : []
  const areas = rawAreas
    .map((a) => a as Record<string, unknown>)
    .filter((a) => isNonEmptyString(a?.category) && isNonEmptyString(a?.summary))
    .slice(0, 3)
    .map((a) => ({ category: a.category as string, summary: a.summary as string }))
  if (areas.length < 3) errors.push('strongest_areas needs 3 usable {category, summary} items')

  // sections — exactly 5, exact names + overview + the two v2 prose fields are hard.
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
      if (!isNonEmptyString(sec?.your_alignment)) errors.push(`sections[${i}].your_alignment missing`)
      if (!isNonEmptyString(sec?.where_you_differ)) errors.push(`sections[${i}].where_you_differ missing`)
      // An unknown must never be rendered as a finding in the two prose fields.
      if (isNonEmptyString(sec?.your_alignment) && assertsUnknown(sec.your_alignment as string))
        errors.push(`sections[${i}].your_alignment asserts an unknown as a finding`)
      if (isNonEmptyString(sec?.where_you_differ) && assertsUnknown(sec.where_you_differ as string))
        errors.push(`sections[${i}].where_you_differ asserts an unknown as a finding`)
      sections.push({
        category: expected,
        classification: typeof sec?.classification === 'string' ? sec.classification : '',
        overview: typeof sec?.overview === 'string' ? sec.overview : '',
        your_alignment: typeof sec?.your_alignment === 'string' ? sec.your_alignment : '',
        where_you_differ: typeof sec?.where_you_differ === 'string' ? sec.where_you_differ : '',
        interpretation: typeof sec?.interpretation === 'string' ? sec.interpretation : '', // omit is valid
        alignments: dropUnknowns(sec?.alignments, 3),
        differences: dropUnknowns(sec?.differences, 2),
      })
    })
  }

  // ── v2: §04 Worth Talking About — exactly 3 items ──
  const wta = (o.worth_talking_about ?? {}) as Record<string, unknown>
  const wtaItems = strArr(wta.items, 5).filter((s) => s.trim().length > 0)
  if (wtaItems.length !== 3) errors.push(`worth_talking_about.items must have exactly 3 (got ${wtaItems.length})`)

  // ── v2: §05 The Signals That Mattered — exactly 6, all clean ──
  const rawChips = strArr(o.signals_that_mattered, 8).filter((s) => s.trim().length > 0)
  if (rawChips.length !== 6) errors.push(`signals_that_mattered must have exactly 6 (got ${rawChips.length})`)
  rawChips.forEach((chip, i) => {
    const v = chipViolations(chip, forbiddenCities)
    if (v.length) errors.push(`signals_that_mattered[${i}] contains forbidden content: ${v.join(', ')}`)
  })

  // synthesis
  const w = (o.what_haevn_thinks_you_should_know ?? {}) as Record<string, unknown>
  if (typeof w !== 'object') errors.push('what_haevn_thinks_you_should_know missing')
  if (!isNonEmptyString(w.strongest_reason)) errors.push('what_haevn…strongest_reason missing')
  if (!isNonEmptyString(w.haevn_assessment)) errors.push('what_haevn…haevn_assessment missing')

  // conversation starters — need at least 3; keep up to 5.
  const starters = strArr(o.conversation_starters, 5)
  if (starters.length < 3) errors.push('conversation_starters needs at least 3 strings')

  // ── v2: closing verdict strip ──
  const cr = (o.closing_read ?? {}) as Record<string, unknown>
  if (!isNonEmptyString(cr.statement)) errors.push('closing_read.statement missing/empty')

  if (errors.length) return { ok: false, errors }

  const value: MatchInterpretation = {
    match_summary: o.match_summary as string,
    executive_summary: o.executive_summary as string,
    why_this_introduction: {
      what_aligns: why.what_aligns as string,
      what_differs: why.what_differs as string,
      the_verdict: why.the_verdict as string,
    },
    strongest_areas: areas,
    nudge_compatibility_highlights: strArr(o.nudge_compatibility_highlights, 3),
    sections,
    worth_talking_about: {
      items: wtaItems,
      closing: typeof wta.closing === 'string' ? wta.closing : '', // omittable
    },
    signals_that_mattered: rawChips,
    what_haevn_thinks_you_should_know: {
      strongest_reason: w.strongest_reason as string,
      most_meaningful_difference: typeof w.most_meaningful_difference === 'string' ? w.most_meaningful_difference : '',
      haevn_assessment: w.haevn_assessment as string,
    },
    conversation_starters: starters,
    closing_read: {
      // Derived in code. The model's echo is deliberately discarded so it can
      // never invent a verdict the strip cannot render — same rule as `classification`.
      verdict: opts.verdict ?? 'INTRODUCTION RECOMMENDED',
      statement: cr.statement as string,
    },
  }
  return { ok: true, value }
}
