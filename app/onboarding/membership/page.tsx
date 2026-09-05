import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import MembershipPlans from './MembershipPlans'
import { getPromoConfig } from '@/lib/promo/config'
import { decideEligibility } from '@/lib/promo/eligibility'
import { loadMemberPromoContext } from '@/lib/promo/memberContext'
import { emitCtaClicked } from '@/lib/promo/events'
import { normalizeTier } from '@/lib/partnership/tier'
import { UNKNOWN_SOURCE } from '@/lib/promo/constants'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlowController } from '@/lib/onboarding/flow'

export const dynamic = 'force-dynamic'

/**
 * THE CHOKE POINT.
 *
 * All 22 member-facing upgrade CTAs already route here, so promo-vs-paid is
 * decided in exactly one place and NO CTA is edited by this PR. The existing paid
 * page is untouched — it is now the `MembershipPlans` client component this
 * server component renders when the member is not eligible.
 *
 * Eligible members are redirected to /founding-member. Everyone else — paid
 * members, members outside an enabled market, members with no resolvable market,
 * and everyone at all when the flag is off — sees exactly what they see today.
 *
 * Attribution without touching 22 files: `?src=` when a CTA passes one, else the
 * referer path, else 'unknown'. upgrade_cta_clicked is emitted on EVERY arrival
 * regardless of outcome, because the client's CTA-click number is the
 * denominator of the activation rate and must not be filtered by eligibility.
 *
 * Onboarding traffic is excluded: /onboarding/membership is also step 9 of the
 * signup flow (lib/onboarding/flow.ts, client-flow.ts, db/onboarding.ts). A
 * member being walked through signup has not expressed upgrade intent. Those
 * three callers pass no marker and are NOT edited by this PR, so instead we ask
 * the flow controller where the member's resume step is: if it is still this
 * page, they are mid-onboarding, and both the redirect and the event are
 * suppressed. `?flow=onboarding` is also honoured if a caller ever sets it.
 */
export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; flow?: string }>
}) {
  const params = await searchParams

  // Onboarding progression is not upgrade intent: render the plans, log nothing.
  if (params.flow === 'onboarding' || (await isMidOnboarding())) return <MembershipPlans />

  const cfg = getPromoConfig()
  const ctx = await loadMemberPromoContext()

  // Source: explicit param wins, then the referring path, then unknown. The
  // referer is a PATH only — never a full URL with query, so nothing leaks.
  let src = params.src?.trim() || ''
  if (!src) {
    try {
      const ref = (await headers()).get('referer')
      src = ref ? new URL(ref).pathname : ''
    } catch {
      src = ''
    }
  }
  const source = src || UNKNOWN_SOURCE

  const decision = decideEligibility({
    cfg,
    tier: ctx?.tier,
    plusSource: ctx?.plusSource,
    marketSlug: ctx?.marketSlug,
    marketDisplayName: ctx?.marketDisplayName,
    cityName: ctx?.cityName,
  })

  // Fire-and-forget: analytics must never delay or break the member's path.
  void emitCtaClicked(ctx?.partnershipId ?? null, {
    src: source,
    path: '/onboarding/membership',
    tier: normalizeTier(ctx?.tier),
    market: ctx?.marketSlug ?? null,
    eligible: decision.eligible,
    reason: decision.eligible ? null : decision.reason,
  })

  if (decision.eligible) {
    redirect(`/founding-member?src=${encodeURIComponent(source)}`)
  }

  // Everyone else: the existing page, byte-for-byte.
  return <MembershipPlans />
}

/**
 * True when the member's resume step IS this page — i.e. they are being walked
 * through signup rather than asking to upgrade. Fails OPEN (returns false, so
 * the member is treated as having upgrade intent) because a controller error
 * must not silently hide the offer from an eligible member.
 */
async function isMidOnboarding(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const resume = await new OnboardingFlowController(supabase).getResumeStep(user.id)
    return resume === '/onboarding/membership'
  } catch {
    return false
  }
}
