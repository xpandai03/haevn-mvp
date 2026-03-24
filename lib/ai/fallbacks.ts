/**
 * HAEVN AI Trust Layer — Fallback Summaries
 *
 * Used when survey data is too sparse for meaningful AI generation.
 * These are safe, neutral, and intentionally generic.
 */

/**
 * Minimum number of populated optional fields required
 * before we attempt AI generation. Below this threshold,
 * fallbacks are returned instead.
 */
export const MIN_FIELDS_FOR_GENERATION = 4

/**
 * Fallback Connection Summary when data is too sparse.
 * Intentionally vague and non-committal.
 */
export function getFallbackConnectionSummary(name: string): string {
  return `${name} is exploring connections on HAEVN and appears to value an intentional approach to dating. Their profile is still developing as they complete more of their survey. More details about their connection style and preferences will become available as their profile grows.`
}

/**
 * Fallback HAEVN Insight when data is too sparse.
 * Acknowledges the sparse state without guessing.
 */
export function getFallbackInsight(): string {
  return `Your responses so far suggest that you are oriented toward intentional connection. As you complete more of your survey, HAEVN will be able to offer a more detailed picture of your relationship style and what kinds of connections are most likely to align with you. Check back after updating your responses for a fuller insight.`
}
