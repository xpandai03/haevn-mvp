/**
 * API Route: Lemonsqueezy Webhook Handler
 * POST /api/lemonsqueezy/webhook
 *
 * Receives order events from Lemonsqueezy, verifies the HMAC-SHA256 signature,
 * and updates the buyer's membership tier. Lemonsqueezy sends no auth session —
 * trust is established purely via the signature — so this uses the service-role
 * admin client (bypasses RLS). Mirrors the structure of the Veriff webhook.
 *
 * Handles:
 *  - order_created  → flip tier to 'plus' (with 6-month expiry), log purchase
 *  - order_refunded → revert tier to 'free'
 *
 * Idempotency: purchases.external_order_id is unique; a repeated order is skipped.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { accessMonthsForPlan } from '@/lib/lemonsqueezy'

/**
 * Verify the Lemonsqueezy webhook signature.
 * Length-guarded so a malformed/short signature returns false instead of
 * throwing inside timingSafeEqual (which requires equal-length buffers).
 */
function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  try {
    const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const sigBuf = Buffer.from(signature, 'hex')
    const digestBuf = Buffer.from(digest, 'hex')
    if (sigBuf.length !== digestBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, digestBuf)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature') || ''
    const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || ''

    // 1. Verify signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('[Lemonsqueezy Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const eventName = payload.meta?.event_name
    const customData = payload.meta?.custom_data || {}
    const partnershipId = customData.partnership_id
    const userId = customData.user_id

    console.log('[Lemonsqueezy Webhook] Event received:', eventName)

    // 2. order_created → grant access
    if (eventName === 'order_created') {
      const orderId = payload.data?.id
      const orderStatus = payload.data?.attributes?.status

      console.log('[Lemonsqueezy Webhook] Order:', { orderId, orderStatus, partnershipId, userId })

      if (!partnershipId) {
        console.error('[Lemonsqueezy Webhook] No partnership_id in custom data')
        return NextResponse.json({ error: 'Missing partnership_id' }, { status: 400 })
      }

      // Only process paid orders.
      if (orderStatus !== 'paid') {
        console.log('[Lemonsqueezy Webhook] Order not paid, skipping:', orderStatus)
        return NextResponse.json({ ok: true, skipped: true })
      }

      const supabase = createAdminClient()

      // 3. Idempotency — don't double-process the same order.
      const { data: existingOrder } = await supabase
        .from('purchases')
        .select('id')
        .eq('external_order_id', String(orderId))
        .maybeSingle()

      if (existingOrder) {
        console.log('[Lemonsqueezy Webhook] Order already processed:', orderId)
        return NextResponse.json({ ok: true, already_processed: true })
      }

      // 4. Compute expiry from the selected plan (plus_6 → 6mo, plus_12 → 12mo).
      const months = accessMonthsForPlan(customData.plan)
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + months)

      // 5. Flip membership tier.
      const { error: updateError } = await supabase
        .from('partnerships')
        .update({
          membership_tier: 'plus',
          membership_expires_at: expiresAt.toISOString(),
        })
        .eq('id', partnershipId)

      if (updateError) {
        console.error('[Lemonsqueezy Webhook] Tier update failed:', updateError)
        return NextResponse.json({ error: 'Tier update failed' }, { status: 500 })
      }

      // 6. Log the purchase (audit + idempotency record).
      const { error: insertError } = await supabase
        .from('purchases')
        .insert({
          partnership_id: partnershipId,
          user_id: userId || null,
          external_order_id: String(orderId),
          provider: 'lemonsqueezy',
          tier: 'plus',
          amount_cents: payload.data?.attributes?.total ?? 0,
          currency: payload.data?.attributes?.currency || 'USD',
          expires_at: expiresAt.toISOString(),
          raw_payload: payload,
        })

      if (insertError) {
        // Tier is already granted; a duplicate insert here means a concurrent
        // delivery won the race. Log but don't fail the webhook.
        console.error('[Lemonsqueezy Webhook] Purchase log insert failed:', insertError)
      }

      console.log('[Lemonsqueezy Webhook] Tier updated to plus for partnership:', partnershipId)
      return NextResponse.json({ ok: true, tier: 'plus', expires_at: expiresAt.toISOString() })
    }

    // 7. order_refunded → revert to free
    if (eventName === 'order_refunded') {
      if (partnershipId) {
        const supabase = createAdminClient()
        await supabase
          .from('partnerships')
          .update({
            membership_tier: 'free',
            membership_expires_at: null,
          })
          .eq('id', partnershipId)

        console.log('[Lemonsqueezy Webhook] Refund processed, tier reverted to free:', partnershipId)
      }
      return NextResponse.json({ ok: true, refunded: true })
    }

    // Unhandled event — acknowledge so Lemonsqueezy stops retrying.
    return NextResponse.json({ ok: true, unhandled: eventName })
  } catch (err: any) {
    console.error('[Lemonsqueezy Webhook] Error:', err?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
