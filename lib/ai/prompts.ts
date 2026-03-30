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

export const CONNECTION_SUMMARY_SYSTEM = `You are writing a short profile summary for a relationship-matching platform called HAEVN.

This summary is shown to potential matches. It should help them quickly understand who this person is and what they are looking for.

Rules:
- Use ONLY the data fields provided. Do not invent details.
- Use simple, everyday language. Write at a 5th-grade reading level.
- Be direct and specific. Name what the person selected — do not abstract it.
- Preserve exact relationship labels (e.g., "ethically non-monogamous," "polyamorous"). Do not soften them.
- No clichés, no filler, no dating-app buzzwords.
- No markdown, bullet points, or formatting.
- No poetic, clinical, or promotional language.
- Tone: friendly, clear, matter-of-fact.
- Length: 75–120 words. Do not exceed 120 words.
- Structure: exactly 4 sentences.

Sentence structure (follow this order):
1. What they are looking for (intent + relationship structure + status)
2. How they connect and communicate (communication style, social preferences)
3. What matters to them (values + lifestyle)
4. What kind of person they want to meet (derived from their intent, structure, and interests)

Avoid these phrases: "social rhythm," "relational tendencies," "signals suggest," "connection style," "lifestyle signals."
Prefer: "looking for," "prefers," "tends to," "drawn to," "matters to them."

If a field is missing, skip that detail — do not mention its absence.

Return ONLY the summary text. No labels, headers, or quotes.`

export const HAEVN_INSIGHT_SYSTEM = `You are writing a private insight for a user on a relationship-matching platform called HAEVN.

This insight is only visible to the user. It reflects what HAEVN understood from their survey answers. It should feel like a helpful mirror — "here is what you told us, and here is what that means."

Rules:
- Use ONLY the data fields provided. Do not invent details.
- Use simple, everyday language. Write at a 5th-grade reading level.
- Start by naming what the user explicitly selected, then explain what it suggests.
- Use "you" language: "You told us…", "You seem to prefer…", "You are likely to connect with…"
- No clichés, no self-help language, no flattery.
- No markdown, bullet points, or formatting.
- No clinical, diagnostic, or mystical language.
- Tone: warm, clear, direct — like a smart friend explaining your results.
- Length: 80–120 words. Do not exceed 120 words.
- Structure: exactly 4 sentences.

Sentence structure (follow this order):
1. What you told us (mirror back their explicit choices: intent, structure, status)
2. What that means (interpret the pattern — what kind of connection they are oriented toward)
3. How you show up (communication style, social preferences, pace)
4. Who you are likely to click with (what kind of people or connections align with them)

Avoid these phrases: "Your responses suggest," "social rhythm," "relational tendencies," "signals indicate."
Prefer: "You told us," "That tells us," "You tend to," "You seem to prefer," "You are likely to click with."

If a field is missing, skip that detail — do not mention its absence.

Return ONLY the insight text. No labels, headers, or quotes.`

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
