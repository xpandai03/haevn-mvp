/**
 * HAEVN AI Trust Layer — Prompt Templates
 *
 * Strict, bounded-interpretation prompts for generating
 * Connection Summaries and HAEVN Insights.
 *
 * CRITICAL: The AI is a controlled translator of structured data,
 * not a creative writer. These prompts enforce that behavior.
 */

import type { SummaryInput } from './types'

// =============================================================================
// CONNECTION SUMMARY (outward-facing, visible to matches)
// =============================================================================

export const CONNECTION_SUMMARY_SYSTEM = `You are generating a short user-facing connection summary for a relationship-matching platform called HAEVN.

Your job is to translate structured survey data into a natural-language summary that helps potential matches understand this person.

Rules:
- Use ONLY the provided data fields. Do not invent traits, hobbies, or backstory.
- Do not use clichés, filler phrases, or generic dating-app language.
- Do not exaggerate or embellish. Make the person sound clearer, not "better."
- Respect exact relationship labels. If the data says "ethically non-monogamous," use that exact phrase — do not soften it to "open-minded" or "flexible."
- Do not use promotional, seductive, poetic, or mystical language.
- Do not use clinical or diagnostic language.
- Do not use bullet points, markdown, or formatting.
- Tone: natural, grounded, concise, neutral.
- Length: 75–120 words. Do not exceed 120 words.
- Structure: exactly 4 sentences.
- Focus on: intent, relationship structure, connection style, communication style, social rhythm, lifestyle signals.
- If a field is missing, skip it naturally — do not mention its absence.

Return ONLY the summary text. No labels, no headers, no quotes.`

export const HAEVN_INSIGHT_SYSTEM = `You are generating a private profile insight for a user on a relationship-matching platform called HAEVN.

This insight is visible ONLY to the user themselves. It reflects how HAEVN interprets their survey responses.

Rules:
- Use ONLY the provided data fields. Do not invent traits, hobbies, or backstory.
- Do not use clichés, filler phrases, or generic self-help language.
- Do not sound clinical, diagnostic, or mystical.
- Do not use romantic, emotional, or flattering language.
- Use soft-confidence language: "Your responses suggest…" not "You are…"
- Do not use bullet points, markdown, or formatting.
- Tone: analytical, observational, grounded, calm.
- Length: 80–120 words. Do not exceed 120 words.
- Structure: exactly 4 sentences.
- Include what kinds of connections or people are most likely to align with this user.
- If a field is missing, skip it naturally — do not mention its absence.

Return ONLY the insight text. No labels, no headers, no quotes.`

// =============================================================================
// USER MESSAGE BUILDERS
// =============================================================================

/**
 * Format SummaryInput into a structured user message for the Connection Summary prompt.
 */
export function buildConnectionSummaryMessage(input: SummaryInput): string {
  const lines: string[] = [`Name: ${input.first_name}`]

  if (input.age !== undefined) lines.push(`Age: ${input.age}`)
  if (input.relationship_intent) lines.push(`Relationship intent: ${input.relationship_intent}`)
  if (input.relationship_structure) lines.push(`Relationship structure: ${input.relationship_structure}`)
  if (input.social_style) lines.push(`Social style: ${input.social_style}`)
  if (input.communication_style) lines.push(`Communication style: ${input.communication_style}`)
  if (input.dating_pace) lines.push(`Dating pace: ${input.dating_pace}`)
  if (input.lifestyle_rhythm) lines.push(`Lifestyle rhythm: ${input.lifestyle_rhythm}`)
  if (input.values && input.values.length > 0) lines.push(`Values: ${input.values.join(', ')}`)
  if (input.interests && input.interests.length > 0) lines.push(`Interests: ${input.interests.join(', ')}`)

  return lines.join('\n')
}

/**
 * Format SummaryInput into a structured user message for the HAEVN Insight prompt.
 */
export function buildInsightMessage(input: SummaryInput): string {
  const lines: string[] = [`User: ${input.first_name}`]

  if (input.age !== undefined) lines.push(`Age: ${input.age}`)
  if (input.relationship_intent) lines.push(`Primary intent: ${input.relationship_intent}`)
  if (input.relationship_structure) lines.push(`Structure preference: ${input.relationship_structure}`)
  if (input.social_style) lines.push(`Social energy: ${input.social_style}`)
  if (input.communication_style) lines.push(`Communication approach: ${input.communication_style}`)
  if (input.dating_pace) lines.push(`Pace preference: ${input.dating_pace}`)
  if (input.lifestyle_rhythm) lines.push(`Lifestyle rhythm: ${input.lifestyle_rhythm}`)
  if (input.values && input.values.length > 0) lines.push(`Core values: ${input.values.join(', ')}`)
  if (input.interests && input.interests.length > 0) lines.push(`Interest areas: ${input.interests.join(', ')}`)

  return lines.join('\n')
}
