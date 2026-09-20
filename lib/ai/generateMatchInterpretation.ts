/**
 * Consolidated match-interpretation generation (one OpenAI call per viewer→match).
 * Mirrors lib/ai/generateSummaries.ts (raw fetch, no SDK) but on a different model
 * (see below) and requests
 * strict JSON via response_format and validates it hard. Returns token usage so the
 * caller can record real cost. A failure or malformed response returns result:null
 * (never throws to the caller) so the card degrades to deterministic section data.
 */

import {
  MATCH_INTERPRETATION_SYSTEM,
  buildMatchInterpretationMessage,
  type InterpretationModelInput,
} from './prompts/matchInterpretation'
import { validateMatchInterpretation, type MatchInterpretation } from './matchInterpretationSchema'

/**
 * MODEL CHOICE, AND WHY THE PROSE IS SHORTER THAN THE DESIGN ASKS FOR.
 *
 * The match report's field targets (45–65 words for each per-category prose
 * field, 90–140 for haevn_assessment) were taken from the client's public sample
 * report. Neither model reaches them, and the reason is NOT model capability:
 *
 *   field                   target   gpt-4o-mini   gpt-4o
 *   section.overview         25–45        11         13     (0/50 in range, both)
 *   your_alignment           45–65        23         32     (0/50 in range, both)
 *   where_you_differ         45–65        24         30     (0/50 in range, both)
 *   haevn_assessment        90–140        46         72     (0/10 in range, both)
 *
 * gpt-4o writes ~40% longer for 18.7x the cost and still misses every
 * section-level target. Strengthening the length instruction moved nothing.
 *
 * THE ACTUAL CONSTRAINT IS INPUT. The whole user message is ~264 words, of which
 * the real evidence is ~30 terse engine labels — "Compatible roles", "Workable
 * structure match", "Shared goals: 100% alignment". Asking for 45–65 words about
 * "Compatible roles" means inventing detail that no supplied datum supports,
 * which rules 2, 6, 7 and 11 of the client's own AI doc forbid outright. The
 * models are under-writing because they are obeying the more important rule.
 *
 * So this stays on mini until the INPUT is richer (the underlying survey answers
 * behind each signal exist in user_survey_responses but are reduced to these
 * labels before they reach the model). Buying a larger model to force padding
 * would be paying more for worse copy. Re-evaluate the model after the input
 * layer improves — not before. See docs/plans/match-report-rebuild.md §4.4.
 */
export const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MAX_TOKENS = 3000
const TEMPERATURE = 0.3

// Pricing (USD / 1M tokens) — for cost reporting only. MUST track OPENAI_MODEL:
// a stale pair here silently misreports every cost number in the readout.
const PRICE_IN_PER_M = 0.15
const PRICE_OUT_PER_M = 0.6

export type InterpretationErrorCode = 'NO_API_KEY' | 'AI_QUOTA_EXCEEDED' | 'AI_UNAVAILABLE' | 'MALFORMED_JSON' | 'SCHEMA_INVALID'

export interface InterpretationUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
}

export interface GenerateInterpretationResult {
  /** The validated interpretation, or null on any failure (caller degrades). */
  result: MatchInterpretation | null
  error?: { code: InterpretationErrorCode; detail?: string }
  usage?: InterpretationUsage
  /** Raw model text, for debugging / sample review. */
  raw?: string
}

const QUOTA_MARKERS = ['exceeded your current quota', 'insufficient_quota', 'billing', 'rate_limit', 'rate limit']

export async function generateMatchInterpretation(
  input: InterpretationModelInput
): Promise<GenerateInterpretationResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[MatchInterp] OPENAI_API_KEY not set')
    return { result: null, error: { code: 'NO_API_KEY', detail: 'OPENAI_API_KEY missing' } }
  }

  let payload: any
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: MATCH_INTERPRETATION_SYSTEM },
          { role: 'user', content: buildMatchInterpretationMessage(input) },
        ],
      }),
    })
    payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = payload?.error?.message || `${res.status} ${res.statusText}`
      const isQuota = QUOTA_MARKERS.some((m) => detail.toLowerCase().includes(m))
      console.error('[MatchInterp] OpenAI request failed —', detail)
      return { result: null, error: { code: isQuota ? 'AI_QUOTA_EXCEEDED' : 'AI_UNAVAILABLE', detail } }
    }
  } catch (e: any) {
    console.error('[MatchInterp] fetch threw —', e?.message)
    return { result: null, error: { code: 'AI_UNAVAILABLE', detail: e?.message } }
  }

  const usage = readUsage(payload)
  // Log real input size every call. The 3,500-token cap is enforced upstream on
  // an ESTIMATE (chars/3.9); this is the only place the ACTUAL count is known,
  // so without it the cap could drift out of true and the cost model with it.
  if (usage) {
    const over = usage.prompt_tokens > 3500 ? ' ⚠ OVER CAP' : ''
    console.log(`[MatchInterp] tokens in=${usage.prompt_tokens} out=${usage.completion_tokens} $${usage.cost_usd.toFixed(5)}${over}`)
  }
  const raw = payload?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    return { result: null, error: { code: 'AI_UNAVAILABLE', detail: 'empty content' }, usage }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[MatchInterp] response was not valid JSON')
    return { result: null, error: { code: 'MALFORMED_JSON', detail: raw.slice(0, 200) }, usage, raw }
  }

  // Verdict is derived in code and the chip constraint needs the pair's cities;
  // both come from the input so the validator can enforce what the prompt asked for.
  const validation = validateMatchInterpretation(parsed, {
    verdict: input.closingVerdict,
    forbiddenCityTokens: input.forbiddenCityTokens ?? [],
  })
  if (!validation.ok) {
    console.error('[MatchInterp] schema invalid —', validation.errors.join('; '))
    return { result: null, error: { code: 'SCHEMA_INVALID', detail: validation.errors.join('; ') }, usage, raw }
  }

  return { result: validation.value, usage, raw }
}

function readUsage(payload: any): InterpretationUsage | undefined {
  const u = payload?.usage
  if (!u) return undefined
  const prompt_tokens = Number(u.prompt_tokens) || 0
  const completion_tokens = Number(u.completion_tokens) || 0
  const cost_usd = (prompt_tokens * PRICE_IN_PER_M + completion_tokens * PRICE_OUT_PER_M) / 1_000_000
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: Number(u.total_tokens) || prompt_tokens + completion_tokens,
    cost_usd,
  }
}
