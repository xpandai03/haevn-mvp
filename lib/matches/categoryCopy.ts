/**
 * Static per-category explainer copy for the match report — `WHAT THIS MEASURES`
 * and `WHY IT MATTERS`, the first two fields inside every expanded category block.
 *
 * WHY THIS LIVES IN CODE AND NEVER IN THE AI CALL. These ten strings are
 * definitional: they describe what a HAEVN category *is*, and they are identical
 * for every member and every pair. Generating them per pair-direction would cost
 * ~2,200 regenerations a week to reproduce the same paragraph, and — far worse —
 * would let the model paraphrase a definitional statement differently for two
 * members looking at the same category. A category's meaning is not a per-pair
 * judgement, so it is not the model's to write.
 *
 * SOURCE. Transcribed verbatim from the client's public sample report at
 * https://haevn.co/match-example, captured 2026-09-20 and archived at
 * docs/specs/match-report-reference/page.txt. The reference page IS the copy
 * spec; nothing here is invented, reworded, or trimmed. If the client revises
 * that page, re-capture and update these strings — do not edit them to taste.
 *
 * Keyed by SectionDef.key so there is exactly one category identity in the app
 * (lib/matches/sectionMapping.ts) and this module cannot drift out of step with
 * the engine's five categories.
 */

import { SECTIONS } from './sectionMapping'

export interface CategoryStaticCopy {
  /** "WHAT THIS MEASURES" — what the category evaluates. */
  whatThisMeasures: string
  /** "WHY IT MATTERS" — why the category is weighed at all. */
  whyItMatters: string
}

export const CATEGORY_STATIC_COPY: Record<string, CategoryStaticCopy> = {
  goals_expectations: {
    whatThisMeasures:
      'Goals & Expectations looks at what each person ultimately wants from a relationship and whether they are moving toward compatible outcomes. This includes relationship intent, commitment expectations, future direction, major priorities, and what each person hopes a successful connection could become.',
    whyItMatters:
      'Two people can have strong chemistry and still be poor matches if they are moving toward fundamentally different destinations. Shared direction gives a connection room to develop without requiring one person to abandon something important later.',
  },
  structure_fit: {
    whatThisMeasures:
      'Structure Fit evaluates whether two people want compatible relationship structures and boundaries. This includes expectations around exclusivity, monogamy or non-monogamy, commitment, autonomy, boundaries, and how the relationship itself is expected to operate.',
    whyItMatters:
      'Relationship structure is difficult to compromise on when two people fundamentally want different things. HAEVN treats structural compatibility as particularly important because attraction cannot resolve incompatible expectations about what the relationship is supposed to be.',
  },
  emotional_communication: {
    whatThisMeasures:
      'Emotional & Communication compatibility looks at how two people communicate, handle disagreement, express emotional needs, give and receive support, and navigate difficult conversations.',
    whyItMatters:
      "Compatibility isn't only about what two people want. It also matters whether they can communicate about those wants when things become difficult. Different communication styles can work together, but large differences may create repeated misunderstanding or emotional friction.",
  },
  sexual_compatibility: {
    whatThisMeasures:
      'Sexual Compatibility evaluates how well your expectations around physical intimacy fit together. This can include the importance of sex within the relationship, desired frequency, initiation, openness, boundaries, communication around intimacy, and other relevant preferences captured by HAEVN.',
    whyItMatters:
      "Sexual compatibility does not require identical preferences. It matters whether two people's needs, expectations, and boundaries can comfortably coexist without either person consistently sacrificing something important.",
  },
  practical_fit: {
    whatThisMeasures:
      'Practical Fit evaluates whether your day-to-day lives can realistically work together. This includes factors such as location, schedules, lifestyle rhythms, social preferences, personal space, habits, routines, and other practical realities captured by HAEVN.',
    whyItMatters:
      'Two people can want the same relationship and communicate beautifully while still discovering that their everyday lives are difficult to combine. Practical compatibility asks whether there is enough overlap for a relationship to function in real life.',
  },
}

/** Static copy for a section key. Never throws — an unknown key yields null. */
export function staticCopyFor(sectionKey: string): CategoryStaticCopy | null {
  return CATEGORY_STATIC_COPY[sectionKey] ?? null
}

/**
 * True when every engine section has both static strings. Asserted in tests so a
 * new or renamed category cannot ship with a blank explainer in the report.
 */
export function hasCopyForEverySection(): boolean {
  return SECTIONS.every((s) => {
    const c = CATEGORY_STATIC_COPY[s.key]
    return !!c && c.whatThisMeasures.trim().length > 0 && c.whyItMatters.trim().length > 0
  })
}
