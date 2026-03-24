/**
 * HAEVN AI Trust Layer — Summary Generation
 *
 * Generates Connection Summaries and HAEVN Insights using Claude.
 *
 * Flow: SummaryInput → prompts → Claude Haiku → validated output
 *
 * CRITICAL DESIGN RULES:
 * - Never call without a valid SummaryInput
 * - Always check field count before calling AI
 * - Enforce word count after generation
 * - Strip any markdown/formatting from output
 */

import Anthropic from '@anthropic-ai/sdk'
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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[AI Summary] ANTHROPIC_API_KEY not set — using fallbacks')
    return {
      connection_summary: getFallbackConnectionSummary(input.first_name),
      haevn_insight: getFallbackInsight(),
      used_fallback: true,
      fields_populated: fieldsPopulated,
    }
  }

  const client = new Anthropic({ apiKey })

  // Generate both summaries in parallel
  const [connectionSummary, haevnInsight] = await Promise.all([
    generateSingle(client, CONNECTION_SUMMARY_SYSTEM, buildConnectionSummaryMessage(input)),
    generateSingle(client, HAEVN_INSIGHT_SYSTEM, buildInsightMessage(input)),
  ])

  return {
    connection_summary: enforceOutputRules(connectionSummary),
    haevn_insight: enforceOutputRules(haevnInsight),
    used_fallback: false,
    fields_populated: fieldsPopulated,
  }
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Call Claude to generate a single summary.
 */
async function generateSingle(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
    ],
  })

  // Extract text from response
  const block = response.content[0]
  if (block.type !== 'text') {
    throw new Error(`[AI Summary] Unexpected response type: ${block.type}`)
  }

  return block.text
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
