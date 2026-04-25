/**
 * HAEVN AI Trust Layer — Summary Generation
 *
 * Generates Connection Summaries and HAEVN Insights using OpenAI's
 * Chat Completions API. Backed by raw fetch (no extra SDK install).
 *
 * Flow: SummaryInput → prompts → OpenAI gpt-4o-mini → validated output
 *
 * CRITICAL DESIGN RULES:
 * - Never call without a valid SummaryInput
 * - Always check field count before calling AI
 * - Enforce word count after generation
 * - Strip any markdown/formatting from output
 *
 * Migration note (2026-04-25): switched from Anthropic Claude Haiku to
 * OpenAI gpt-4o-mini. System prompts in ./prompts.ts are unchanged —
 * only the inference call is different.
 */

import type { SummaryInput } from './types'
import { countPopulatedSummaryFields } from './buildSummaryInput'
import {
  CONNECTION_SUMMARY_SYSTEM,
  HAEVN_INSIGHT_SYSTEM,
  buildConnectionSummaryMessage,
  buildInsightMessage,
} from './prompts'
import {
  MIN_FIELDS_FOR_GENERATION,
  getFallbackConnectionSummary,
  getFallbackInsight,
} from './fallbacks'

// =============================================================================
// CONFIG
// =============================================================================

const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MAX_TOKENS = 300
const TEMPERATURE = 0.3

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedSummaries {
  connection_summary: string
  haevn_insight: string
  used_fallback: boolean
  fields_populated: number
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Generate both Connection Summary and HAEVN Insight for a user.
 *
 * Returns fallbacks if data is too sparse (< MIN_FIELDS_FOR_GENERATION populated fields).
 * Enforces word count and strips formatting after generation.
 */
export async function generateSummaries(input: SummaryInput): Promise<GeneratedSummaries> {
  const fieldsPopulated = countPopulatedSummaryFields(input)

  // Sparse data → return safe fallbacks
  if (fieldsPopulated < MIN_FIELDS_FOR_GENERATION) {
    console.log(`[AI Summary] Sparse data (${fieldsPopulated}/${MIN_FIELDS_FOR_GENERATION} fields) — using fallbacks`)
    return {
      connection_summary: getFallbackConnectionSummary(input.first_name),
      haevn_insight: getFallbackInsight(),
      used_fallback: true,
      fields_populated: fieldsPopulated,
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[AI Summary] OPENAI_API_KEY not set — using fallbacks')
    return {
      connection_summary: getFallbackConnectionSummary(input.first_name),
      haevn_insight: getFallbackInsight(),
      used_fallback: true,
      fields_populated: fieldsPopulated,
    }
  }

  // Generate both summaries in parallel
  try {
    const [connectionSummary, haevnInsight] = await Promise.all([
      generateSingle(apiKey, CONNECTION_SUMMARY_SYSTEM, buildConnectionSummaryMessage(input)),
      generateSingle(apiKey, HAEVN_INSIGHT_SYSTEM, buildInsightMessage(input)),
    ])

    return {
      connection_summary: enforceOutputRules(connectionSummary),
      haevn_insight: enforceOutputRules(haevnInsight),
      used_fallback: false,
      fields_populated: fieldsPopulated,
    }
  } catch (err) {
    console.error('[AI Summary] OpenAI call failed — using fallbacks:', err)
    return {
      connection_summary: getFallbackConnectionSummary(input.first_name),
      haevn_insight: getFallbackInsight(),
      used_fallback: true,
      fields_populated: fieldsPopulated,
    }
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { role?: string; content?: string | null }
    finish_reason?: string
  }>
  error?: { message?: string; type?: string; code?: string }
}

/**
 * Call OpenAI Chat Completions to generate a single summary.
 * Maps Anthropic's (system, user) shape to OpenAI's `messages` array.
 */
async function generateSingle(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  const payload = (await res.json().catch(() => ({}))) as OpenAIChatResponse

  if (!res.ok) {
    const detail = payload?.error?.message || `${res.status} ${res.statusText}`
    throw new Error(`[AI Summary] OpenAI request failed: ${detail}`)
  }

  const text = payload.choices?.[0]?.message?.content
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('[AI Summary] OpenAI returned empty content')
  }

  return text
}

/**
 * Enforce output guardrails on generated text.
 *
 * - Strip markdown formatting
 * - Remove bullet points
 * - Remove leading/trailing quotes
 * - Enforce max word count (120 words — hard cap)
 */
function enforceOutputRules(text: string): string {
  let cleaned = text.trim()

  // Remove markdown formatting
  cleaned = cleaned.replace(/[*_#`~]/g, '')

  // Remove bullet points / list markers
  cleaned = cleaned.replace(/^[-•●]\s*/gm, '')

  // Remove leading/trailing quotes
  cleaned = cleaned.replace(/^["'""]+|["'""]+$/g, '')

  // Collapse multiple newlines into single space
  cleaned = cleaned.replace(/\n+/g, ' ')

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ')

  // Enforce word count: hard cap at 120 words
  const words = cleaned.split(/\s+/)
  if (words.length > 120) {
    // Find the last sentence boundary within 120 words
    const truncated = words.slice(0, 120).join(' ')
    const lastPeriod = truncated.lastIndexOf('.')
    if (lastPeriod > 0) {
      cleaned = truncated.slice(0, lastPeriod + 1)
    } else {
      cleaned = truncated + '.'
    }
  }

  return cleaned.trim()
}
