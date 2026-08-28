/**
 * The membership-tier predicate. ONE definition of "is this partnership paid?".
 *
 * WHY THIS EXISTS
 * `partnerships.membership_tier` is the single source of truth, but its VALUE has
 * drifted: migration 001 declared an enum ('free','plus','select') that was never
 * fully applied, the Lemon Squeezy webhook writes 'plus', and the live table held
 * 'pro' until migration 055 canonicalized it. Code compared the raw column against
 * 'plus' in places, which silently read a 'pro' member as unpaid — a real bug in
 * hooks/usePartnerStats.ts, not a hypothetical.
 *
 * 055 canonicalizes to 'plus'. This predicate still accepts 'pro' — permanently,
 * not transitionally — because a value that has been in production must never
 * again depend on a migration having run everywhere. Accepting it costs nothing;
 * rejecting it locks a paying member out.
 *
 * PAIRS WITH, DOES NOT REPLACE, canAccessConnection(): that gate adds read-time
 * expiry on top of this and remains the single reveal/messaging gate.
 */

/** Canonical tier values. 'pro' is legacy-but-live; 'select' predates the product. */
export type MembershipTier = 'free' | 'plus' | 'pro'

/** Every value that grants paid access. Expiry is applied separately. */
const PAID_TIERS = new Set(['plus', 'pro', 'select'])

/**
 * Is this raw `membership_tier` value a paid tier?
 * Null/undefined/unknown → false (fail closed: an unrecognised value is not paid).
 */
export function isPaidTier(raw: string | null | undefined): boolean {
  if (!raw) return false
  return PAID_TIERS.has(raw.trim().toLowerCase())
}

/**
 * Collapse a raw value to the two states the UI actually renders.
 * The inverse of isPaidTier, expressed as the type most callers want.
 */
export function normalizeTier(raw: string | null | undefined): 'free' | 'plus' {
  return isPaidTier(raw) ? 'plus' : 'free'
}

/** Convenience for the many `tier === 'free'` reads. */
export function isFreeTier(raw: string | null | undefined): boolean {
  return !isPaidTier(raw)
}
