import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js'

/**
 * Initialise the Lemonsqueezy SDK with the API key.
 * Call this once per request before using any SDK function (createCheckout, etc.).
 * Kept lazy so `next build` does not require the API key at module-eval time.
 */
export function initLemonSqueezy() {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY!,
  })
}

/**
 * Lemonsqueezy configuration sourced from env, with the live product variant
 * ids hardcoded as defaults so checkout works immediately without Vercel env
 * changes. Both HAEVN+ products are one-time payments:
 *   - plus6  → HAEVN+ 6 months  ($199)  variant 1732138
 *   - plus12 → HAEVN+ 12 months ($299)  variant 1732215
 * Env vars still override the defaults when present.
 */
export const LEMONSQUEEZY_CONFIG = {
  storeId: process.env.LEMONSQUEEZY_STORE_ID!,
  webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET!,
  variants: {
    plus6: process.env.LEMONSQUEEZY_VARIANT_ID_PLUS_6 || '1732138',
    plus12: process.env.LEMONSQUEEZY_VARIANT_ID_PLUS_12 || '1732215',
  },
  /**
   * @deprecated Legacy single-variant env. Retained for back-compat; falls
   * back to the 6-month variant so existing `{ tier: 'plus' }` callers work.
   */
  variantIdPlus:
    process.env.LEMONSQUEEZY_VARIANT_ID_PLUS ||
    process.env.LEMONSQUEEZY_VARIANT_ID_PLUS_6 ||
    '1732138',
} as const

/** Plan ids exposed to clients. */
export type LemonPlan = 'plus_6' | 'plus_12'

/** Months of HAEVN+ access granted per plan. */
export function accessMonthsForPlan(plan: string): number {
  return plan === 'plus_12' ? 12 : 6
}

/** Maps a plan id to its configured Lemonsqueezy variant id ('' if unknown). */
export function variantIdForPlan(plan: string): string {
  switch (plan) {
    case 'plus_12':
      return LEMONSQUEEZY_CONFIG.variants.plus12
    case 'plus_6':
      return LEMONSQUEEZY_CONFIG.variants.plus6
    default:
      return ''
  }
}

/**
 * Back-compat: maps a membership tier to a variant id. `plus` resolves to the
 * 6-month (Most Popular) product.
 */
export function variantIdForTier(tier: string): string {
  switch (tier) {
    case 'plus':
      return LEMONSQUEEZY_CONFIG.variants.plus6
    default:
      return ''
  }
}
