/**
 * Consolidated match-interpretation generation (one OpenAI call per viewer→match).
 * Mirrors lib/ai/generateSummaries.ts (raw fetch, gpt-4o-mini, no SDK) but requests
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

const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MAX_TOKENS = 2000
const TEMPERATURE = 0.3

// gpt-4o-mini pricing (USD / 1M tokens) — for cost reporting only.
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

  const validation = validateMatchInterpretation(parsed)
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
