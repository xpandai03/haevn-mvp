/**
 * Founding Member promotion — configuration.
 *
 * Paid checkout cannot complete while the client secures a processor, so eligible
 * free members in enabled markets are granted a complimentary HAEVN+ term. This
 * is presented as a thank-you and NEVER as a workaround: no member-facing surface
 * may reference payment availability.
 *
 * Server-only. No NEXT_PUBLIC_ prefix on any of these — eligibility is decided on
 * the server and must not be inspectable or forgeable from the browser.
 *
 * KILL SWITCH: FOUNDING_PROMO_ENABLED=false restores paid routing for everyone,
 * instantly, with no DB write and no code deploy. Members who already activated
 * keep HAEVN+ until it expires — disabling the promo revokes nothing.
 */

export interface PromoConfig {
  enabled: boolean
  /**
   * markets.slug values, OR the sentinel `all`. Empty = no market enabled, so
   * nobody is eligible.
   */
  markets: string[]
  termMonths: number
}

/**
 * Sentinel accepted in FOUNDING_PROMO_MARKETS to mean "every market, and every
 * member whose city resolves to no market at all".
 *
 * WHY A SENTINEL AND NOT A LONGER LIST: `markets` holds exactly one row (Austin),
 * because a market row is created only when the client approves a city list. So
 * "enable Portland" is not a config change — there is no `portland` slug to name.
 * Members outside Austin resolve to NO slug, which is precisely the case the slug
 * list cannot express. The sentinel widens the market axis and nothing else;
 * every other eligibility axis still fails closed.
 *
 * A market slugged literally 'all' would collide. `markets.slug` is admin-set and
 * Austin is the only row, so this is theoretical — but it is why the value is a
 * named constant rather than a bare string spread through the code.
 */
export const PROMO_ALL_MARKETS = 'all'

/** Term fallback if the env var is absent or unparseable. The client's launch value. */
export const DEFAULT_TERM_MONTHS = 6

export function getPromoConfig(): PromoConfig {
  const term = Number.parseInt(process.env.FOUNDING_PROMO_TERM_MONTHS ?? '', 10)
  return {
    enabled: process.env.FOUNDING_PROMO_ENABLED === 'true',
    markets: (process.env.FOUNDING_PROMO_MARKETS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    // Guard the parse: a typo'd env var must not grant a 0-month or NaN term.
    termMonths: Number.isFinite(term) && term > 0 ? term : DEFAULT_TERM_MONTHS,
  }
}

/**
 * Is the promo open to every market (and to members with no market at all)?
 * False whenever the promo is disabled — the kill switch outranks the sentinel.
 */
export function isAllMarkets(cfg: PromoConfig): boolean {
  return cfg.enabled && cfg.markets.includes(PROMO_ALL_MARKETS)
}

/**
 * Is this market slug enabled? Slugs come from markets.slug — never a literal.
 * Under the `all` sentinel the slug is irrelevant, including when it is null.
 */
export function isMarketEnabled(cfg: PromoConfig, slug: string | null | undefined): boolean {
  if (!cfg.enabled) return false
  if (isAllMarkets(cfg)) return true
  if (!slug) return false
  return cfg.markets.includes(slug.trim().toLowerCase())
}

/**
 * Messaging kill switch, independent of tier.
 *
 * Before this flag, chat was gated on membership tier ALONE, so granting HAEVN+
 * would have opened messaging to every activated member the moment the promo went
 * live. The client needs messaging to stay closed while underwriting is open, so
 * tier no longer opens chat on its own. Default OFF — absent env means closed.
 */
export function isMessagingEnabled(): boolean {
  return process.env.MESSAGING_ENABLED === 'true'
}
