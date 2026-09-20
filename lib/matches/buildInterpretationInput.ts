/**
 * Assemble the model input for one viewer→match interpretation from raw survey
 * answers + the engine sections. Reuses the SAME deterministic assemblers the
 * matching/summary paths use: normalizeAnswers → buildSummaryInput (identity-safe,
 * kink-generalized). For free viewers the match's first_name is stripped before
 * it can reach the model (defense in depth on top of the prompt's rule 8).
 */

import { normalizeAnswers } from '@/lib/matching/utils/normalizeAnswers'
import { buildSummaryInput } from '@/lib/ai/buildSummaryInput'
import type { RawAnswers } from '@/lib/matching/types'
import type { InterpretationModelInput, InterpretationSectionInput } from '@/lib/ai/prompts/matchInterpretation'
import { verdictForScore, type Section } from './sectionMapping'
import { buildEnrichedComparison, estimateTokens, INPUT_TOKEN_CAP } from './enrichedAnswers'
import { MATCH_INTERPRETATION_SYSTEM } from '@/lib/ai/prompts/matchInterpretation'

/** Engine reasons that denote UNKNOWN (unanswered) data — never a difference. */
const UNKNOWN_REASON = /not specified|unspecified|have not specified|not answered|no data|unknown/i

export interface BuildInterpretationInputParams {
  viewerAnswers: Record<string, unknown>
  viewerDisplayName: string | null
  matchAnswers: Record<string, unknown>
  matchDisplayName: string | null
  sections: Section[]
  matchScore: number
  nudged: boolean
  membership: 'free' | 'plus'
  /** Cities that must never surface in a §05 signal chip (both members'). */
  forbiddenCityTokens?: string[]
  /** Raw survey answers, used to build the per-category evidence block. */
  viewerRawAnswers?: Record<string, unknown>
  matchRawAnswers?: Record<string, unknown>
}

export function buildInterpretationInput(p: BuildInterpretationInputParams): InterpretationModelInput {
  const viewer = buildSummaryInput({
    answers: normalizeAnswers(p.viewerAnswers as RawAnswers),
    displayName: p.viewerDisplayName || 'You',
  })
  const match = buildSummaryInput({
    answers: normalizeAnswers(p.matchAnswers as RawAnswers),
    // Free viewers must never receive the match's real name, even to the model.
    displayName: p.membership === 'free' ? 'This person' : p.matchDisplayName || 'This person',
  })
  if (p.membership === 'free') match.first_name = 'This person'

  const sections: InterpretationSectionInput[] = p.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const signals: string[] = []
      const unknowns: string[] = []
      for (const ss of s.subScores) {
        const reason = (ss.reason || '').trim()
        if (!reason) continue
        // An unanswered/"not specified" signal is UNKNOWN, not a difference.
        if (!ss.matched || UNKNOWN_REASON.test(reason)) unknowns.push(reason)
        else signals.push(reason)
      }
      return { category: s.displayName, classification: s.band.label, score: s.score, coverage: s.coverage, signals, unknowns }
    })

  // Evidence block, sized to whatever is left under the total input cap once the
  // system prompt and the rest of the user message are accounted for. The cap is
  // on TOTAL input per call, not on this block alone, so the budget is computed
  // rather than assumed — otherwise a longer system prompt silently blows it.
  const fixedTokens =
    estimateTokens(MATCH_INTERPRETATION_SYSTEM) +
    estimateTokens(JSON.stringify(viewer)) +
    estimateTokens(JSON.stringify(match)) +
    estimateTokens(sections.map((x) => JSON.stringify(x)).join('')) +
    120 // headers, score line, verdict line, city line
  const enriched = buildEnrichedComparison(
    p.viewerRawAnswers ?? {},
    p.matchRawAnswers ?? {},
    { tokenBudget: Math.max(0, INPUT_TOKEN_CAP - fixedTokens) }
  )

  return {
    viewer,
    match,
    matchScore: p.matchScore,
    sections,
    nudged: p.nudged,
    membership: p.membership,
    enrichedAnswers: enriched.block,
    // Derived here, not passed in, so the verdict can never disagree with the
    // score the same object carries.
    closingVerdict: verdictForScore(p.matchScore),
    forbiddenCityTokens: p.forbiddenCityTokens ?? [],
  }
}
