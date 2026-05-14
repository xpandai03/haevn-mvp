/**
 * Canonical ordering for a partnership pair (UUID string compare).
 */
export function canonicalPartnershipPair(
  a: string,
  b: string
): { partnership_smaller: string; partnership_larger: string } {
  return a < b
    ? { partnership_smaller: a, partnership_larger: b }
    : { partnership_smaller: b, partnership_larger: a }
}
