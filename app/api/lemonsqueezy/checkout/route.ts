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

    // Pre-flight diagnostics — logs config presence (NOT secret values) and
    // the exact identifiers used, so a 500 in the Vercel logs immediately
    // shows whether it's a missing key, wrong store, or bad variant id.
    const apiKey = process.env.LEMONSQUEEZY_API_KEY || ''
    console.log('[Lemonsqueezy] Checkout attempt', {
      plan,
      variantId,
      storeId: LEMONSQUEEZY_CONFIG.storeId,
      apiKeyPresent: !!apiKey,
      apiKeyLength: apiKey.length,
      // Test-mode keys are prefixed with the mode; surface just the prefix so
      // we can tell test vs live keys apart without leaking the secret.
      apiKeyPrefix: apiKey ? apiKey.slice(0, 8) : null,
      webhookSecretPresent: !!process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
      partnershipId,
    })

    if (!apiKey) {
      console.error('[Lemonsqueezy] LEMONSQUEEZY_API_KEY is not set')
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
      // The SDK returns { data, error, statusCode } and does NOT throw on a
      // 4xx — the real reason (e.g. "Variant not found", invalid store, bad
      // API key) lives in checkout.error / statusCode. Serialize it fully so
      // it's readable in the Vercel logs rather than "[object Object]".
      const lsError = checkout.error as any
      console.error('[Lemonsqueezy] Checkout creation failed', {
        statusCode: checkout.statusCode,
        errorMessage: lsError?.message,
        // The JSON:API error body (array of { detail, ... }) is the goldmine.
        errorBody: safeStringify(lsError?.cause ?? lsError),
        rawError: safeStringify(lsError),
        variantId,
        storeId: LEMONSQUEEZY_CONFIG.storeId,
      })
      return NextResponse.json(
        {
          error: 'Failed to create checkout',
          // Non-secret upstream detail to aid debugging from the client too.
          detail: lsError?.message || `Lemonsqueezy returned status ${checkout.statusCode ?? 'unknown'}`,
          statusCode: checkout.statusCode ?? null,
        },
        { status: 502 }
      )
    }

    console.log('[Lemonsqueezy] Checkout created', { variantId, hasUrl: true })
    return NextResponse.json({ checkoutUrl })
  } catch (err: any) {
    console.error('[Lemonsqueezy] Checkout threw', {
      message: err?.message,
      name: err?.name,
      cause: safeStringify(err?.cause),
      stack: err?.stack,
    })
    return NextResponse.json(
      { error: 'Internal server error', detail: err?.message || null },
      { status: 500 }
    )
  }
}

/** JSON.stringify that won't throw on circular refs / odd shapes. */
function safeStringify(value: unknown): string | null {
  if (value == null) return null
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return null
    }
  }
}
