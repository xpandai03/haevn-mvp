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
  return `${name} is exploring connections on HAEVN. Their profile is still being built as they finish their survey. Once they complete more questions, you will be able to see what they are looking for and how they like to connect.`
}

/**
 * Fallback HAEVN Insight when data is too sparse.
 * Acknowledges the sparse state without guessing.
 */
export function getFallbackInsight(): string {
  return `We do not have enough from your survey yet to give you a full picture. As you answer more questions, we will be able to show you what your answers mean and what kind of people you are most likely to click with. Come back after finishing more of your survey.`
}
