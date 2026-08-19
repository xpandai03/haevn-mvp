/**
 * getMatchInterpretation — the cache/generate/degrade orchestrator.
 *
 * Read match_interpretations by (viewer, match); serve if fresh (engine_version +
 * source_computed_at match the live computed_matches row). On miss/stale, generate
 * once, upsert, and return. On ANY generation failure, return the deterministic
 * sections with payload:null and degraded:true — the card always renders.
 *
 * Sections (score + band + engine reasons) are ALWAYS returned so the caller can
 * render immediately regardless of AI state — no blocking spinner, no broken card.
 */

import type { createAdminClient } from '@/lib/supabase/admin'
import { parseSections, type Section } from './sectionMapping'
import { buildInterpretationInput } from './buildInterpretationInput'
import { hasMatchNudgedViewer } from './nudgeState'
import { generateMatchInterpretation, type InterpretationUsage } from '@/lib/ai/generateMatchInterpretation'
import {
  MATCH_INTERPRETATION_SYSTEM,
  buildMatchInterpretationMessage,
  type InterpretationModelInput,
} from '@/lib/ai/prompts/matchInterpretation'
import type { MatchInterpretation } from '@/lib/ai/matchInterpretationSchema'

type Admin = ReturnType<typeof createAdminClient>
const MODEL = 'gpt-4o-mini'
const SCHEMA_VERSION = 'v1'

export interface MatchInterpretationResult {
  sections: Section[]
  matchScore: number | null
  payload: MatchInterpretation | null
  degraded: boolean
  source: 'cache' | 'generated' | 'degraded' | 'no_match'
  usage?: InterpretationUsage
  error?: string
}

export interface GetInterpretationOpts {
  /** Skip cache read + write (used by the QA sample route). */
  noCache?: boolean
  /**
   * Cache-read only — on a miss/stale, return degraded (deterministic sections)
   * WITHOUT calling the model. Used by the card LIST so a page render never blocks
   * on N generations; the breakdown route + warm cron do the actual generation.
   */
  cacheOnly?: boolean
}

export async function getMatchInterpretation(
  admin: Admin,
  viewerPartnershipId: string,
  matchPartnershipId: string,
  opts: GetInterpretationOpts = {}
): Promise<MatchInterpretationResult> {
  // 1. Live computed_matches row for the pair (either direction — score/breakdown symmetric).
  const { data: cm } = await admin
    .from('computed_matches')
    .select('score, breakdown, engine_version, computed_at')
    .or(
      `and(partnership_a.eq.${viewerPartnershipId},partnership_b.eq.${matchPartnershipId}),` +
        `and(partnership_a.eq.${matchPartnershipId},partnership_b.eq.${viewerPartnershipId})`
    )
    .limit(1)
    .maybeSingle()

  if (!cm) {
    return { sections: parseSections(null), matchScore: null, payload: null, degraded: true, source: 'no_match' }
  }

  const sections = parseSections(cm.breakdown)
  const matchScore = typeof cm.score === 'number' ? cm.score : null
  const engineVersion = String(cm.engine_version ?? '')
  const sourceComputedAt = String(cm.computed_at ?? '')

  // 2. Cache read + freshness.
  if (!opts.noCache) {
    const { data: cached } = await admin
      .from('match_interpretations')
      .select('payload, engine_version, source_computed_at')
      .eq('viewer_partnership_id', viewerPartnershipId)
      .eq('match_partnership_id', matchPartnershipId)
      .maybeSingle()
    if (cached && cached.engine_version === engineVersion && String(cached.source_computed_at) === sourceComputedAt) {
      return { sections, matchScore, payload: cached.payload as MatchInterpretation, degraded: false, source: 'cache' }
    }
  }

  // Cache-only callers (the list) never generate synchronously — degrade on a miss.
  if (opts.cacheOnly) {
    return { sections, matchScore, payload: null, degraded: true, source: 'degraded' }
  }

  // 3. Generate. Gather both members' survey + display name + viewer membership + nudge.
  const gen = await generateForPair(admin, viewerPartnershipId, matchPartnershipId, sections, matchScore ?? 0)
  if (!gen.result) {
    return { sections, matchScore, payload: null, degraded: true, source: 'degraded', usage: gen.usage, error: gen.error }
  }

  // 4. Cache-fill (best-effort — a write failure never blocks the render).
  if (!opts.noCache) {
    await admin
      .from('match_interpretations')
      .upsert(
        {
          viewer_partnership_id: viewerPartnershipId,
          match_partnership_id: matchPartnershipId,
          engine_version: engineVersion,
          source_computed_at: sourceComputedAt,
          model: MODEL,
          schema_version: SCHEMA_VERSION,
          payload: gen.result,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'viewer_partnership_id,match_partnership_id' }
      )
      .then(
        () => {},
        (e: unknown) => console.warn('[getMatchInterpretation] cache upsert failed:', e)
      )
  }

  return { sections, matchScore, payload: gen.result, degraded: false, source: 'generated', usage: gen.usage }
}

async function generateForPair(
  admin: Admin,
  viewerPartnershipId: string,
  matchPartnershipId: string,
  sections: Section[],
  matchScore: number
): Promise<{ result: MatchInterpretation | null; usage?: InterpretationUsage; error?: string }> {
  const assembled = await assembleInterpretationForPair(admin, viewerPartnershipId, matchPartnershipId, sections, matchScore)
  if (!assembled) return { result: null, error: 'partnership/survey missing' }
  const gen = await generateMatchInterpretation(assembled.input)
  return { result: gen.result, usage: gen.usage, error: gen.error?.detail || gen.error?.code }
}

export interface AssembledInterpretation {
  input: InterpretationModelInput
  systemPrompt: string
  userMessage: string
  membership: 'free' | 'plus'
  nudged: boolean
}

/**
 * Gather both members' survey + profile, resolve membership + nudge state, and
 * build the exact model input + prompt strings for one pair — WITHOUT calling the
 * model. Shared by the live path and the QA sample route (which surfaces the
 * prompt for copy review). Returns null if a partnership is missing.
 */
export async function assembleInterpretationForPair(
  admin: Admin,
  viewerPartnershipId: string,
  matchPartnershipId: string,
  sections: Section[],
  matchScore: number
): Promise<AssembledInterpretation | null> {
  const { data: parts } = await admin
    .from('partnerships')
    .select('id, owner_id, display_name, membership_tier')
    .in('id', [viewerPartnershipId, matchPartnershipId])
  const byId = new Map((parts ?? []).map((p: any) => [p.id, p]))
  const viewer = byId.get(viewerPartnershipId)
  const match = byId.get(matchPartnershipId)
  if (!viewer || !match) return null

  const ownerIds = [viewer.owner_id, match.owner_id].filter(Boolean)
  const { data: surveys } = await admin
    .from('user_survey_responses')
    .select('user_id, answers_json, completion_pct')
    .in('user_id', ownerIds)
  const answersByOwner = new Map<string, Record<string, unknown>>()
  for (const s of surveys ?? []) {
    if (!s.user_id || !s.answers_json) continue
    const prev = answersByOwner.get(s.user_id)
    if (!prev || (s.completion_pct ?? 0) > 0) answersByOwner.set(s.user_id, s.answers_json)
  }

  const membership: 'free' | 'plus' = viewer.membership_tier && viewer.membership_tier !== 'free' ? 'plus' : 'free'
  const nudged = await hasMatchNudgedViewer(admin, viewerPartnershipId, matchPartnershipId)

  const input = buildInterpretationInput({
    viewerAnswers: answersByOwner.get(viewer.owner_id) ?? {},
    viewerDisplayName: viewer.display_name,
    matchAnswers: answersByOwner.get(match.owner_id) ?? {},
    matchDisplayName: match.display_name,
    sections,
    matchScore,
    nudged,
    membership,
  })

  return {
    input,
    systemPrompt: MATCH_INTERPRETATION_SYSTEM,
    userMessage: buildMatchInterpretationMessage(input),
    membership,
    nudged,
  }
}
