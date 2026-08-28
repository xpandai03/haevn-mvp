/** The value written to partnerships.plus_source for a promo activation. */
export const FOUNDING_MEMBER_PROMO = 'founding_member_promo'
/** The value for a real purchase, for symmetry when the webhook is next touched. */
export const PAID_SOURCE = 'paid'
/** Used when a CTA passes no source. CTAs are deliberately not edited by this PR. */
export const UNKNOWN_SOURCE = 'unknown'

/** system_events.event_type values for the promo funnel. */
export const PROMO_EVENTS = {
  ctaClicked: 'upgrade_cta_clicked',
  offerViewed: 'founding_offer_viewed',
  activationCompleted: 'founding_activation_completed',
} as const
