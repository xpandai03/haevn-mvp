import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyUnsubToken } from '@/lib/suppression/unsubToken'
import { recordSuppression } from '@/lib/suppression/emailSuppressions'

export const dynamic = 'force-dynamic'

/**
 * Unsubscribe from the recurring re-notification email. No login.
 *   GET  ?token=…  → landing page with a Confirm button.
 *   POST ?token=…  → writes the suppression (reason=unsubscribe, scope=renotify).
 *                    Serves both the Confirm button AND RFC 8058 one-click
 *                    (List-Unsubscribe-Post: List-Unsubscribe=One-Click).
 * Only the weekly re-notify is suppressed — MATCH NOTIFICATIONS CONTINUE.
 * Token is HMAC(email+scope); forged/tampered tokens are rejected with no write.
 */

function html(body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>HAEVN</title><style>body{font-family:system-ui,sans-serif;max-width:520px;margin:10vh auto;padding:0 24px;color:#0F2A4A;line-height:1.6}` +
      `.btn{display:inline-block;margin-top:16px;padding:12px 28px;background:#008080;color:#fff;border:0;border-radius:24px;font-size:15px;cursor:pointer;text-decoration:none}` +
      `.muted{color:#64748b;font-size:14px}</style></head><body>${body}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}

function tokenFrom(request: NextRequest, formToken?: string | null): string {
  return request.nextUrl.searchParams.get('token') || formToken || ''
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request)
  const secret = process.env.UNSUBSCRIBE_SECRET || ''
  const res = verifyUnsubToken(token, secret)
  if (!res) {
    return html(`<h2>Link expired or invalid</h2><p class="muted">This unsubscribe link couldn’t be verified. No changes were made.</p>`, 400)
  }
  // Confirm page — one click POSTs back with the same token.
  return html(
    `<h2>Unsubscribe from weekly nudges?</h2>` +
      `<p>You’ll stop receiving the weekly “you have matches waiting” reminder for <strong>${escapeHtml(res.email)}</strong>.</p>` +
      `<p class="muted">You’ll still receive a notification when you get a genuinely new match — that isn’t affected.</p>` +
      `<form method="POST" action="/api/unsubscribe?token=${encodeURIComponent(token)}"><button class="btn" type="submit">Confirm unsubscribe</button></form>`
  )
}

export async function POST(request: NextRequest) {
  // One-click clients POST with a form body; the Confirm button posts with the
  // token in the query. Accept either.
  let formToken: string | null = null
  try {
    const ct = request.headers.get('content-type') || ''
    if (ct.includes('form')) {
      const form = await request.formData()
      formToken = (form.get('token') as string) || null
    }
  } catch { /* no body */ }

  const token = tokenFrom(request, formToken)
  const secret = process.env.UNSUBSCRIBE_SECRET || ''
  const res = verifyUnsubToken(token, secret)
  if (!res) {
    return html(`<h2>Link expired or invalid</h2><p class="muted">This unsubscribe link couldn’t be verified. No changes were made.</p>`, 400)
  }

  await recordSuppression(createAdminClient(), {
    email: res.email,
    reason: 'unsubscribe',
    source: 'unsub_link',
    detail: { via: 'unsub_link' },
  })

  return html(
    `<h2>You’re unsubscribed</h2>` +
      `<p>We won’t send weekly reminder emails to <strong>${escapeHtml(res.email)}</strong> anymore.</p>` +
      `<p class="muted">You’ll still be notified when you get a genuinely new match — those aren’t affected by this.</p>`
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
