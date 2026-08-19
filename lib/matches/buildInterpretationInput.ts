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
import type { Section } from './sectionMapping'

export interface BuildInterpretationInputParams {
  viewerAnswers: Record<string, unknown>
  viewerDisplayName: string | null
  matchAnswers: Record<string, unknown>
  matchDisplayName: string | null
  sections: Section[]
  matchScore: number
  nudged: boolean
  membership: 'free' | 'plus'
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
    .map((s) => ({
      category: s.displayName,
      classification: s.band.label,
      score: s.score,
      coverage: s.coverage,
      engineReasons: s.subScores.map((ss) => ss.reason).filter((r) => r && r.trim().length > 0),
    }))

  return { viewer, match, matchScore: p.matchScore, sections, nudged: p.nudged, membership: p.membership }
}
