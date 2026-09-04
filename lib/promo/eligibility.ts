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
import { isAllMarkets, isMarketEnabled } from './config'

export type IneligibleReason =
  | 'promo_disabled'
  | 'already_paid'
  | 'already_activated'
  | 'no_market'
  | 'market_not_enabled'

export type Eligibility =
  | {
      eligible: true
      /** markets.slug, or null when the member resolves to no market (sentinel only). */
      marketSlug: string | null
      /** markets.display_name, '' when there is none. Kept for existing callers. */
      marketDisplayName: string
      /** partnerships.city — the member's own city, whether or not it is a market. */
      cityName: string
      /**
       * The ONE city string member-facing copy should interpolate:
       * market display name, else the member's own city, else '' (city-less variant).
       */
      displayCity: string
      /**
       * What partnerships.promo_market records: the market slug when there is
       * one, else the member's actual city, else null. Decided here so no caller
       * re-derives it and the two can never drift.
       */
      promoMarket: string | null
      termMonths: number
    }
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
  /**
   * partnerships.city. Under the `all` sentinel this is what carries the copy and
   * the attribution for a member whose city belongs to no market. Optional so
   * every existing caller keeps compiling and behaves exactly as before.
   */
  cityName?: string | null | undefined
}

export function decideEligibility(input: EligibilityInput): Eligibility {
  const { cfg, tier, plusSource, marketSlug, marketDisplayName, cityName } = input

  if (!cfg.enabled) return { eligible: false, reason: 'promo_disabled' }

  // Paid members are never shown the promo — checked before anything else that
  // could redirect them. A stale CTA in an old tab must not reach the offer.
  if (isPaidTier(tier)) return { eligible: false, reason: 'already_paid' }

  // Defensive: a free tier that already carries a promo source means an
  // activation was rolled back or expired. Do not grant a second term here.
  if (plusSource) return { eligible: false, reason: 'already_activated' }

  // THE ONLY WIDENED AXIS. Without the sentinel this is byte-for-byte the old
  // behaviour: no slug -> no_market. With it, a member who resolves to no market
  // is eligible on the strength of every other axis, which is the whole point —
  // outside Austin there is no slug to name.
  if (!marketSlug && !isAllMarkets(cfg)) return { eligible: false, reason: 'no_market' }
  if (!isMarketEnabled(cfg, marketSlug)) return { eligible: false, reason: 'market_not_enabled' }

  // Copy needs a city name. Prefer the market's display name, fall back to the
  // member's own city, and if there is neither, callers render the city-less
  // variant of the sentence — never a hardcoded literal.
  const display = marketDisplayName ?? ''
  const city = cityName?.trim() ?? ''

  return {
    eligible: true,
    marketSlug: marketSlug ?? null,
    marketDisplayName: display,
    cityName: city,
    displayCity: display || city,
    promoMarket: marketSlug ?? (city || null),
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
