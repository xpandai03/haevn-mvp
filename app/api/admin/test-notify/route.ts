/**
 * TEMPORARY dry-run harness — send ONE match notification to a recipient the
 * admin controls (their own email + phone) and return the FULL per-channel
 * result, including the exact Resend error (the production logs only stored
 * "[object Object]"). Lets us diagnose why notification email fails while SMS
 * works, without touching any real user.
 *
 * ⚠️ DELETE THIS FILE after the dry-run. Secret-gated.
 *
 * GET /api/admin/test-notify?secret=...&to=<email>&phone=<+1...>
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { sendNotification, buildSignInUrl } from '@/lib/services/notifications'

export const maxDuration = 60

const SECRET = 'biuHbjkiCAKCMk0oi_Ly6EC4yZA'

function ok(provided: string | null): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

function serialize(err: unknown): unknown {
  if (err == null) return null
  if (typeof err === 'string') return err
  try {
    // Resend errors are plain objects ({ statusCode, message, name }) — expose them fully.
    return JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err as object)))
  } catch {
    return String(err)
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  if (!ok(url.searchParams.get('secret'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const to = url.searchParams.get('to')
  const phone = url.searchParams.get('phone')
  const magicfor = url.searchParams.get('magicfor') // email to mint a real magic sign-in link for
  if (!to && !phone) {
    return NextResponse.json({ error: 'provide ?to=<email> and/or ?phone=<+1...>' }, { status: 400 })
  }

  // Mint a per-user magic sign-in link (mirrors the cron's real path) so the
  // test SMS carries a working passwordless login, not a dead /dashboard link.
  const signInUrl = magicfor ? await buildSignInUrl(magicfor) : undefined

  // Same call the real match notification uses — but to the admin's own contact.
  const result = await sendNotification({
    type: 'match',
    email: to || null,
    phone: phone || null,
    signInUrl: signInUrl ?? undefined,
  })

  return NextResponse.json({
    resendApiKeyPresent: !!process.env.RESEND_API_KEY,
    fromAddress: 'HAEVN <notifications@haevn.co>',
    magicLinkMintedFor: magicfor || null,
    signInUrl: signInUrl || null,
    sms: { sent: result.sms.sent, error: serialize(result.sms.error) },
    email: { sent: result.email.sent, error: serialize(result.email.error) },
  })
}
