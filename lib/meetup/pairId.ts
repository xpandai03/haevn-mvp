/**
 * Stable, unlinkable pair identifier for the meetup feed.
 *
 * pair_id = HMAC-SHA256(salt, "<partnership_smaller>:<partnership_larger>") hex.
 * Canonical ordering (canonicalPartnershipPair) makes it direction-independent,
 * so the same pair yields the SAME id every night; the dedicated salt makes it
 * unlinkable back to partnership ids without the secret. Partnership/user ids
 * never leave the server — only this token does.
 */

import { createHmac } from 'crypto'
import { canonicalPartnershipPair } from '@/lib/utils/partnershipPair'

export function computePairId(a: string, b: string, salt: string): string {
  const { partnership_smaller, partnership_larger } = canonicalPartnershipPair(a, b)
  return createHmac('sha256', salt).update(`${partnership_smaller}:${partnership_larger}`).digest('hex')
}
