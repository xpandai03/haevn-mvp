'use server'

/**
 * Founding Member activation.
 *
 * THE WRITE IS A SINGLE CONDITIONAL UPDATE. Eligibility is re-checked inside the
 * statement — `membership_tier = 'free' AND plus_source IS NULL` — so:
 *   - two tabs submitting at once produce ONE activation and ONE event;
 *   - a paid membership can never be overwritten, nor its expiry touched;
 *   - if the flag flips or the tier changes between viewing and activating, the
 *     update matches zero rows and the member is sent to the existing page.
 *
 * No purchase row, no order id, no amount, no processor call. This is a grant,
 * not a transaction.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPromoConfig } from '@/lib/promo/config'
import { decideEligibility, computeExpiry } from '@/lib/promo/eligibility'
import { loadMemberPromoContext } from '@/lib/promo/memberContext'
import { emitActivationCompleted } from '@/lib/promo/events'
import { FOUNDING_MEMBER_PROMO, UNKNOWN_SOURCE } from '@/lib/promo/constants'

export type ActivationResult =
  | { status: 'activated' }
  | { status: 'already_active' }
  | { status: 'ineligible' }

export async function activateFoundingMembership(src?: string): Promise<ActivationResult> {
  const cfg = getPromoConfig()
  const ctx = await loadMemberPromoContext()
  if (!ctx) return { status: 'ineligible' }

  // A member who already took the promo gets the confirmation, not a second term.
  if (ctx.plusSource === FOUNDING_MEMBER_PROMO) return { status: 'already_active' }

  const decision = decideEligibility({
    cfg,
    tier: ctx.tier,
    plusSource: ctx.plusSource,
    marketSlug: ctx.marketSlug,
    marketDisplayName: ctx.marketDisplayName,
  })
  if (!decision.eligible) return { status: 'ineligible' }

  const source = (src ?? '').trim() || UNKNOWN_SOURCE
  const now = new Date()
  const expiresAt = computeExpiry(decision.termMonths, now)

  const admin = createAdminClient()
  const { data: claimed, error } = await admin
    .from('partnerships')
    .update({
      membership_tier: 'plus',
      membership_expires_at: expiresAt.toISOString(),
      plus_source: FOUNDING_MEMBER_PROMO,
      plus_activated_at: now.toISOString(),
      promo_market: decision.marketSlug,
      promo_cta_source: source,
    })
    .eq('id', ctx.partnershipId)
    // ── the atomic guard: only a free, never-activated row can be claimed ──
    .eq('membership_tier', 'free')
    .is('plus_source', null)
    .select('id')

  if (error) {
    console.error('[founding-activation] update failed:', error.message)
    return { status: 'ineligible' }
  }

  // Zero rows = someone else won the race, or the row stopped being eligible.
  if (!claimed || claimed.length !== 1) {
    const { data: after } = await admin
      .from('partnerships')
      .select('plus_source')
      .eq('id', ctx.partnershipId)
      .maybeSingle()
    const src2 = (after as { plus_source?: string | null } | null)?.plus_source
    return src2 === FOUNDING_MEMBER_PROMO ? { status: 'already_active' } : { status: 'ineligible' }
  }

  await emitActivationCompleted(ctx.partnershipId, {
    src: source,
    market: decision.marketSlug,
    term_months: decision.termMonths,
    expires_at: expiresAt.toISOString(),
  })

  console.log('[founding-activation] activated partnership=', ctx.partnershipId.slice(0, 8), 'market=', decision.marketSlug)

  // The tier is read on nearly every surface; drop the cached shells.
  revalidatePath('/', 'layout')
  return { status: 'activated' }
}
