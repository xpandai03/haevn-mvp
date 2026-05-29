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
 * Lemonsqueezy configuration sourced from env.
 *
 * `variantIdPlus` maps the HAEVN+ membership package to a Lemonsqueezy product
 * variant. It is intentionally allowed to be empty until the product is created
 * in the Lemonsqueezy dashboard — the checkout route returns a clear error when
 * it is missing rather than failing silently.
 */
export const LEMONSQUEEZY_CONFIG = {
  storeId: process.env.LEMONSQUEEZY_STORE_ID!,
  variantIdPlus: process.env.LEMONSQUEEZY_VARIANT_ID_PLUS || '',
  webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET!,
} as const

/** Maps a membership tier to its configured Lemonsqueezy variant id. */
export function variantIdForTier(tier: string): string {
  switch (tier) {
    case 'plus':
      return LEMONSQUEEZY_CONFIG.variantIdPlus
    default:
      return ''
  }
}
