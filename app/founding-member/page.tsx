import { redirect } from 'next/navigation'
import { getPromoConfig } from '@/lib/promo/config'
import { decideEligibility } from '@/lib/promo/eligibility'
import { loadMemberPromoContext } from '@/lib/promo/memberContext'
import { emitOfferViewed } from '@/lib/promo/events'
import { FOUNDING_MEMBER_PROMO, UNKNOWN_SOURCE } from '@/lib/promo/constants'
import { PLUS_BENEFITS } from '@/app/onboarding/membership/MembershipPlans'
import { FoundingOffer } from './FoundingOffer'
import { FoundingConfirmation } from './FoundingConfirmation'

export const dynamic = 'force-dynamic'

/**
 * The Founding Member offer.
 *
 * Server component: eligibility is decided here, never in the browser, so the
 * offer cannot be reached by typing the URL. An ineligible direct visitor is sent
 * to /onboarding/membership — the same place they would have landed anyway, with
 * no hint that an offer exists for anyone else.
 *
 * A member who has already activated sees the confirmation instead of the offer,
 * so a bookmarked link or a browser back button never re-activates or implies a
 * second term.
 *
 * NOTHING on this page references payment availability. It is a thank-you.
 */
export default async function FoundingMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>
}) {
  const params = await searchParams
  const source = params.src?.trim() || UNKNOWN_SOURCE

  const cfg = getPromoConfig()
  const ctx = await loadMemberPromoContext()
  if (!ctx) redirect('/onboarding/membership')

  // Already a founding member → confirmation, not the offer.
  if (ctx.plusSource === FOUNDING_MEMBER_PROMO) {
    return <FoundingConfirmation cityName={ctx.marketDisplayName ?? ''} />
  }

  const decision = decideEligibility({
    cfg,
    tier: ctx.tier,
    plusSource: ctx.plusSource,
    marketSlug: ctx.marketSlug,
    marketDisplayName: ctx.marketDisplayName,
  })
  if (!decision.eligible) redirect('/onboarding/membership')

  void emitOfferViewed(ctx.partnershipId, {
    src: source,
    market: decision.marketSlug,
    term_months: decision.termMonths,
  })

  return (
    <FoundingOffer
      cityName={decision.marketDisplayName}
      termMonths={decision.termMonths}
      benefits={PLUS_BENEFITS}
      src={source}
    />
  )
}
