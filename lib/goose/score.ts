/**
 * Cohort scoring: the weekly engine, unchanged, over an arbitrary population.
 *
 * REUSE, NOT REIMPLEMENTATION. Each pair goes through
 * calculateCompatibilityFromRaw — the same function, the same 8 hard gates and
 * the same five categories the weekly recompute uses. Inputs are built exactly
 * as computeMatchesForPartnership builds them (first completed member survey,
 * partnership lat/long spread on top, couple = profile_type 'couple').
 *
 * What a cohort deliberately does NOT apply (the event is its own universe):
 * the profile_state='live' filter, matching_excluded, handshake exclusion, the
 * market release gate, and the 77 storage floor. Every pair gets a row; a
 * hard-gated pair scores 0, which is what the engine itself returns.
 *
 * computeMatches.ts is not imported or modified: it is a 'use server' module
 * whose functions write computed_matches. Nothing here can.
 */

import { calculateCompatibilityFromRaw } from '@/lib/matching/calculateCompatibility'
import type { RawAnswers } from '@/lib/matching/types'
import { gooseBandFor, toCompatibilityPct } from './gooseBandCopy'
import { enumeratePairs } from './pairs'
import type { PairResultRow, ScorableMember } from './types'

/**
 * The engine version stamped on cohort rows. MUST equal ENGINE_VERSION in
 * lib/services/computeMatches.ts (not importable: 'use server' modules may only
 * export async functions). A test pins the two together.
 */
export const GOOSE_ENGINE_VERSION = '5cat-v6'

export interface PartnershipInput {
  id: string
  profile_type: string | null
  latitude: number | null
  longitude: number | null
}

export interface MemberLink {
  user_id: string
  role?: string | null
}

export interface SurveyInput {
  answers_json: unknown
  completion_pct: number | null
}

/**
 * Build one member's engine input, or null when it has no completed survey.
 *
 * Survey choice matches the weekly path ("first member with a completed
 * survey"). The weekly path's member order is whatever the DB returns; here it
 * is made deterministic — owner first, then user id — so a couple with two
 * completed surveys always scores from the same one.
 */
export function buildScorableMember(
  partnership: PartnershipInput,
  members: readonly MemberLink[],
  surveyByUser: ReadonlyMap<string, SurveyInput>
): ScorableMember | null {
  const ordered = [...members].sort(
    (a, b) => Number(b.role === 'owner') - Number(a.role === 'owner') || a.user_id.localeCompare(b.user_id)
  )
  let answers: RawAnswers | null = null
  for (const m of ordered) {
    const s = surveyByUser.get(m.user_id)
    if (s && (s.completion_pct ?? 0) >= 100 && s.answers_json) {
      answers = s.answers_json as RawAnswers
      break
    }
  }
  if (!answers) return null
  const raw: RawAnswers = {
    ...answers,
    ...(partnership.latitude != null && partnership.longitude != null
      ? { _latitude: partnership.latitude, _longitude: partnership.longitude }
      : {}),
  }
  return { memberId: partnership.id, raw, isCouple: partnership.profile_type === 'couple' }
}

export interface PairScore {
  score: number
  gated: boolean
}

/** One pair, through the unmodified engine. Gated → the engine's own 0. */
export function scorePair(a: ScorableMember, b: ScorableMember): PairScore {
  const r = calculateCompatibilityFromRaw(a.raw as RawAnswers, b.raw as RawAnswers, a.isCouple, b.isCouple)
  // The gate's reason (r.constraints.reason) embeds raw answers. It is read
  // nowhere and stored nowhere: only the boolean survives.
  const gated = !r.constraints.passed
  return { score: gated ? 0 : toCompatibilityPct(r.overallScore), gated }
}

/**
 * Score every unordered pair of the members given. Pairs where either side has
 * no input are skipped (they surface as a coverage shortfall, never as a
 * fabricated score).
 */
export function scoreCohortPairs(
  cohortId: string,
  finalizationId: string,
  memberIds: readonly string[],
  inputs: ReadonlyMap<string, ScorableMember | null>
): { rows: PairResultRow[]; gated: number; skipped: number } {
  const rows: PairResultRow[] = []
  let gated = 0
  let skipped = 0
  for (const [a, b] of enumeratePairs(memberIds)) {
    const ia = inputs.get(a)
    const ib = inputs.get(b)
    if (!ia || !ib) {
      skipped++
      continue
    }
    const s = scorePair(ia, ib)
    if (s.gated) gated++
    rows.push({
      cohort_id: cohortId,
      member_a: a,
      member_b: b,
      finalization_id: finalizationId,
      score: s.score,
      band: gooseBandFor(s.score).band,
      gated: s.gated,
      engine_version: GOOSE_ENGINE_VERSION,
    })
  }
  return { rows, gated, skipped }
}
