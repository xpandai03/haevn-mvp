import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySvixSignature } from '@/lib/suppression/svix'
import { recordSuppression } from '@/lib/suppression/emailSuppressions'

export const dynamic = 'force-dynamic'

/**
 * Resend webhook receiver (bounces / complaints).
 * ================================================
 * DASHBOARD REGISTRATION (manual, cannot be done from code):
 *   URL:    https://haevn.app/api/webhooks/resend
 *   Events: email.bounced, email.complained  (+ email.delivery_delayed for
 *           soft-bounce visibility — logged, never suppressed)
 *   Copy the signing secret (whsec_…) into Vercel env RESEND_WEBHOOK_SECRET.
 *
 * Until RESEND_WEBHOOK_SECRET is set the route FAILS CLOSED (401, no writes) —
 * an unverified webhook writing suppressions could mass-silence every user, so
 * signature verification is mandatory. Verified manually (Svix scheme) — no
 * `svix` dependency, matching the repo's other webhooks.
 *
 *   email.bounced (permanent)  → suppress reason=hard_bounce scope=renotify
 *   email.complained           → suppress reason=complaint  scope=all_noncritical
 *   transient/soft / other     → 200 ack, logged, NO suppression
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (
    !verifySvixSignature({
      secret: process.env.RESEND_WEBHOOK_SECRET || '',
      headers: {
        svixId: request.headers.get('svix-id'),
        svixTimestamp: request.headers.get('svix-timestamp'),
        svixSignature: request.headers.get('svix-signature'),
      },
      rawBody,
    })
  ) {
    console.error('[Resend webhook] Invalid signature — rejected, no write')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type: string = payload?.type || ''
  const data = payload?.data || {}
  // Resend delivers the recipient(s) in data.to (array or string).
  const recipients: string[] = Array.isArray(data.to) ? data.to : data.to ? [data.to] : []

  // Determine reason, or null = acknowledge without suppressing.
  let reason: 'hard_bounce' | 'complaint' | null = null
  if (type === 'email.complained') {
    reason = 'complaint'
  } else if (type === 'email.bounced') {
    // email.bounced is the PERMANENT bounce. If a transient/soft subtype ever
    // surfaces, log only (don't suppress on a temporary failure).
    const bounceType = String(data?.bounce?.type ?? data?.bounce?.subType ?? '').toLowerCase()
    reason = /transient|soft|delayed|undetermined/.test(bounceType) ? null : 'hard_bounce'
  }

  if (!reason || recipients.length === 0) {
    return NextResponse.json({ ok: true, acknowledged: type, suppressed: 0 })
  }

  const admin = createAdminClient()
  const detail = {
    event_type: type,
    email_id: data?.email_id ?? null,
    bounce: data?.bounce ?? null,
    svix_id: request.headers.get('svix-id'),
    created_at: payload?.created_at ?? null,
  }

  let suppressed = 0
  for (const email of recipients) {
    const r = await recordSuppression(admin, { email, reason, source: 'resend_webhook', detail })
    if (r.ok) suppressed++
  }

  console.log(`[Resend webhook] ${type} → ${reason} for ${suppressed}/${recipients.length} recipient(s)`)
  return NextResponse.json({ ok: true, type, reason, suppressed })
}
