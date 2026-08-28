/**
 * Founding Member eligibility — pure, so the whole matrix is unit-tested without
 * a DB, a session, or a request.
 *
 * FAIL CLOSED on every axis. An unknown market, an unreadable market index, a
 * missing tier, or a disabled flag all resolve to "not eligible" and the member
 * simply sees the existing membership page. Wrongly showing the paid page is
 * recoverable; wrongly granting a free membership is not.
 */

import { isPaidTier } from '@/lib/partnership/tier'
import type { PromoConfig } from './config'
import { isMarketEnabled } from './config'

export type IneligibleReason =
  | 'promo_disabled'
  | 'already_paid'
  | 'already_activated'
  | 'no_market'
  | 'market_not_enabled'

export type Eligibility =
  | { eligible: true; marketSlug: string; marketDisplayName: string; termMonths: number }
  | { eligible: false; reason: IneligibleReason }

export interface EligibilityInput {
  cfg: PromoConfig
  /** raw partnerships.membership_tier */
  tier: string | null | undefined
  /** raw partnerships.plus_source */
  plusSource: string | null | undefined
  /** markets.slug for the member's resolved market, or null if unresolved */
  marketSlug: string | null | undefined
  /** markets.display_name — what member-facing copy interpolates */
  marketDisplayName: string | null | undefined
}

export function decideEligibility(input: EligibilityInput): Eligibility {
  const { cfg, tier, plusSource, marketSlug, marketDisplayName } = input

  if (!cfg.enabled) return { eligible: false, reason: 'promo_disabled' }

  // Paid members are never shown the promo — checked before anything else that
  // could redirect them. A stale CTA in an old tab must not reach the offer.
  if (isPaidTier(tier)) return { eligible: false, reason: 'already_paid' }

  // Defensive: a free tier that already carries a promo source means an
  // activation was rolled back or expired. Do not grant a second term here.
  if (plusSource) return { eligible: false, reason: 'already_activated' }

  if (!marketSlug) return { eligible: false, reason: 'no_market' }
  if (!isMarketEnabled(cfg, marketSlug)) return { eligible: false, reason: 'market_not_enabled' }

  return {
    eligible: true,
    marketSlug,
    // Copy needs a city name; if the market row has no display_name we still
    // must not fall back to a hardcoded literal, so callers render the
    // city-less variant of the sentence.
    marketDisplayName: marketDisplayName ?? '',
    termMonths: cfg.termMonths,
  }
}

/** Has this partnership already taken the promo? Drives the confirmation state. */
export function hasActivatedPromo(plusSource: string | null | undefined, promoValue: string): boolean {
  return (plusSource ?? '') === promoValue
}

/**
 * Term end date for an activation.
 *
 * UTC month arithmetic on purpose. setMonth() operates in LOCAL time, so a term
 * that crosses a daylight-saving boundary lands an hour off (Aug 28 12:00Z + 6
 * months came out as Feb 28 13:00Z under US Central). Harmless for a 6-month
 * membership, but it makes the value non-deterministic across deploy regions and
 * untestable, so we do the arithmetic in UTC where an hour is always an hour.
 *
 * Month-end overflow follows JS semantics (Aug 31 + 6mo -> Mar 3), same as the
 * Lemon Squeezy webhook, so promo and paid terms behave identically.
 */
export function computeExpiry(termMonths: number, now: Date = new Date()): Date {
  const d = new Date(now)
  d.setUTCMonth(d.getUTCMonth() + termMonths)
  return d
}
