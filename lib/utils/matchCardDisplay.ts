/**
 * Shared helpers for match / profile card display (first name, age, distance).
 */

export function firstNameFromDisplayName(displayName: string | null | undefined): string {
  const raw = displayName?.trim()
  if (!raw) return 'Member'
  const firstSegment = raw.split(/[\s_]+/).filter(Boolean)[0]
  if (!firstSegment) return 'Member'
  const lower = firstSegment.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Accepts ISO date string or { year, month, day } from survey storage. */
export function computeAgeFromBirthRaw(raw: unknown): number | undefined {
  if (!raw) return undefined
  let y: number | undefined
  let m: number | undefined
  let d: number | undefined
  if (typeof raw === 'string') {
    const dt = new Date(raw)
    if (!Number.isNaN(dt.getTime())) {
      y = dt.getUTCFullYear()
      m = dt.getUTCMonth() + 1
      d = dt.getUTCDate()
    }
  } else if (typeof raw === 'object' && raw !== null) {
    const o = raw as { year?: number; month?: number; day?: number }
    y = o.year
    m = o.month
    d = o.day
  }
  if (!y) return undefined
  const today = new Date()
  let age = today.getUTCFullYear() - y
  if (m && d) {
    const monthDelta = today.getUTCMonth() + 1 - m
    if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < d)) {
      age -= 1
    }
  }
  if (age < 0 || age > 130) return undefined
  return age
}

export function relationshipStylesFromSurveyAnswers(
  answers: Record<string, unknown> | null | undefined
): string | null {
  if (!answers) return null
  const styles = answers.q6_relationship_styles
  if (Array.isArray(styles) && styles.length > 0) {
    return styles
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 3)
      .join(', ')
  }
  if (typeof styles === 'string' && styles.trim()) return styles.trim()
  return null
}

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}
