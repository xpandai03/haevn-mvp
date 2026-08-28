import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  classifyHandoff,
  hashHandoffToken,
  HANDOFF_COPY,
  HANDOFF_STATUS,
  type HandoffRow,
} from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Impersonation handoff LANDING PAGE. A plain GET that renders and does nothing.
 *
 * This route is the whole fix for the 2026-08-25 incident. The admin's browser
 * (or something in their network path) GETs any URL it sees within ~2s. Under
 * the old flow that URL was a single-use Supabase magic link, so the scanner
 * always won and the human always got "expired". Here the scanner gets HTML and
 * burns nothing: NOTHING is consumed on GET. Redemption requires the POST to
 * /api/impersonate/consume that this page's button issues.
 *
 * Deliberately NOT under /admin and NOT admin-gated: the whole point is that it
 * opens in a Chrome guest profile with no session. The 256-bit token IS the
 * credential — which is why the page shows first initial + user id and no email.
 *
 * Implemented as a route handler rather than a page so it can set no-store /
 * noindex / no-referrer itself. Mirrors the shipped /api/unsubscribe pattern:
 * GET confirms, POST acts, no client JS anywhere.
 */

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  // A scanner must never serve a stale copy of this to the human, and this page
  // must never be cached by a CDN keyed on the token.
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function html(body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex,nofollow"><title>HAEVN — admin sign-in</title><style>` +
      `body{font-family:system-ui,sans-serif;max-width:520px;margin:10vh auto;padding:0 24px;color:#0F2A4A;line-height:1.6}` +
      `.btn{display:inline-block;margin-top:8px;padding:12px 28px;background:#008080;color:#fff;border:0;border-radius:24px;font-size:15px;cursor:pointer}` +
      `.muted{color:#64748b;font-size:14px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}` +
      `.card{border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:20px 0}` +
      `.warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:12px 16px;font-size:14px}` +
      `</style></head><body>${body}</body></html>`,
    { status, headers: HEADERS }
  )
}

/** first initial only — never the member's full name or email on this page. */
function firstInitial(fullName: string | null | undefined): string {
  const c = (fullName ?? '').trim()[0]
  return c ? c.toUpperCase() + '.' : '—'
}

function errorPage(state: keyof typeof HANDOFF_COPY): NextResponse {
  const { title, detail } = HANDOFF_COPY[state]
  return html(
    `<h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(detail)}</p>`,
    HANDOFF_STATUS[state]
  )
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  // A failed POST bounces back here; show why rather than re-classifying a row
  // the consume route already rolled back.
  if (request.nextUrl.searchParams.get('e') === 'failed') return errorPage('failed')

  const admin = createAdminClient()
  const { data } = await admin
    .from('impersonation_log')
    .select('target_user_id, reason, expires_at, consumed_at')
    .eq('token_hash', hashHandoffToken(token))
    .maybeSingle()

  const row = (data ?? null) as (HandoffRow & { reason: string }) | null
  const state = classifyHandoff(row, Date.now())
  if (state !== 'valid' || !row) return errorPage(state === 'valid' ? 'invalid' : state)

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('user_id', row.target_user_id)
    .maybeSingle()

  const minsLeft = Math.max(1, Math.round((Date.parse(row.expires_at!) - Date.now()) / 60000))

  return html(
    `<h2>Sign in as this member</h2>` +
      `<div class="card">` +
      `<div><strong>Member</strong> ${escapeHtml(firstInitial(profile?.full_name))}</div>` +
      `<div class="mono muted">${escapeHtml(row.target_user_id)}</div>` +
      `<div style="margin-top:10px"><strong>Reason</strong> ${escapeHtml(row.reason)}</div>` +
      `</div>` +
      `<p class="warn">Open this in a <strong>Chrome guest profile</strong>. Using it in your normal window will sign you out of your admin account.</p>` +
      `<form method="POST" action="/api/impersonate/consume">` +
      `<input type="hidden" name="token" value="${escapeHtml(token)}">` +
      `<button class="btn" type="submit">Sign in as this member</button>` +
      `</form>` +
      `<p class="muted">This link works once and expires in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}. Nothing has been used up by opening this page.</p>`
  )
}
