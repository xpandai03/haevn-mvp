/**
 * API Route: Lemonsqueezy Checkout
 * POST /api/lemonsqueezy/checkout
 *
 * Creates a Lemonsqueezy hosted checkout session for the signed-in user's
 * partnership and returns the checkout URL. `partnership_id` and `user_id` are
 * embedded in the checkout custom data so the webhook can identify the buyer
 * when the order is paid.
 *
 * Body: { plan?: 'plus_6' | 'plus_12', tier?: 'plus', variantId?: string }
 *   `plan` is preferred; `tier: 'plus'` (legacy) maps to the 6-month plan.
 * Returns: { checkoutUrl: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createCheckout } from '@lemonsqueezy/lemonsqueezy.js'
import { initLemonSqueezy, LEMONSQUEEZY_CONFIG, variantIdForPlan } from '@/lib/lemonsqueezy'
import { createClient } from '@/lib/supabase/server'
import { getCurrentPartnershipId } from '@/lib/actions/partnership'

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://haevn-mvp.vercel.app'
  ).replace(/\/+$/, '')
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth — get the current user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Resolve the user's active partnership (multi-partnership safe).
    const { id: partnershipId, error: partnershipError } = await getCurrentPartnershipId()
    if (partnershipError || !partnershipId) {
      return NextResponse.json({ error: 'No partnership found' }, { status: 400 })
    }

    // 3. Determine the plan + variant to purchase.
    const body = await request.json().catch(() => ({}))
    // Prefer explicit `plan`; fall back to legacy `tier: 'plus'` → 6-month plan.
    const plan: string =
      typeof body?.plan === 'string' && body.plan
        ? body.plan
        : body?.tier === 'plus' || !body?.tier
          ? 'plus_6'
          : ''
    const variantId = body?.variantId || variantIdForPlan(plan)

    if (!variantId) {
      console.error('[Lemonsqueezy] Invalid/unconfigured plan:', body?.plan ?? body?.tier)
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    if (!LEMONSQUEEZY_CONFIG.storeId) {
      console.error('[Lemonsqueezy] LEMONSQUEEZY_STORE_ID is not set')
      return NextResponse.json({ error: 'Payment not configured' }, { status: 500 })
    }

    // 4. Create the checkout.
    initLemonSqueezy()

    const checkout = await createCheckout(
      LEMONSQUEEZY_CONFIG.storeId,
      variantId,
      {
        checkoutData: {
          email: user.email || undefined,
          custom: {
            partnership_id: partnershipId,
            user_id: user.id,
            // The webhook reads `plan` to set the correct access duration.
            plan,
            tier: 'plus',
          },
        },
        productOptions: {
          redirectUrl: `${appUrl()}/upgrade/success`,
        },
      }
    )

    const checkoutUrl = checkout.data?.data?.attributes?.url

    if (!checkoutUrl) {
      console.error('[Lemonsqueezy] Checkout creation failed:', checkout.error || checkout)
      return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
    }

    return NextResponse.json({ checkoutUrl })
  } catch (err: any) {
    console.error('[Lemonsqueezy] Checkout error:', err?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
