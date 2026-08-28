import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyHandoff, hashHandoffToken, type HandoffRow } from '@/lib/auth/handoff'
import { LOGIN_LINK_TTL_MINUTES } from '@/lib/auth/loginLink'

export const dynamic = 'force-dynamic'

/**
 * Sign-in handoff LANDING PAGE. A plain GET that renders and does nothing.
 *
 * This is the whole reason the emailed link is not a magic link. Mail clients,
 * spam filters and link scanners GET every URL in an email, often within
 * seconds. Under a raw-magic-link design they would burn the token and the
 * member would meet "expired" on their first ever sign-in. Here a scanner gets
 * HTML and burns nothing: NOTHING is consumed on GET. Signing in requires the
 * POST that this page's button issues.
 *
 * Implemented as a route handler, not a page, so it can set no-store / noindex
 * itself. No client JS — it must work in any mail-client in-app browser.
 */

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
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
      `<meta name="robots" content="noindex,nofollow"><title>Sign in to HAEVN</title><style>` +
      `body{font-family:system-ui,sans-serif;max-width:460px;margin:12vh auto;padding:0 24px;color:#0F2A4A;line-height:1.6;text-align:center}` +
      `.btn{display:inline-block;margin-top:8px;padding:14px 32px;background:#008080;color:#fff;border:0;border-radius:24px;font-size:16px;cursor:pointer}` +
      `.muted{color:#64748b;font-size:14px}a{color:#008080}` +
      `</style></head><body>${body}</body></html>`,
    { status, headers: HEADERS }
  )
}

/** Member-facing copy. Never says whether an account exists — you only reach
 *  this page by holding a token we issued. */
const COPY = {
  expired: {
    title: 'This link has expired',
    detail: `Sign-in links last ${LOGIN_LINK_TTL_MINUTES} minutes. Enter your email again and we&rsquo;ll send a fresh one.`,
    status: 410,
  },
  used: {
    title: 'This link was already used',
    detail: 'Each sign-in link works once. Enter your email again for a new one.',
    status: 410,
  },
  invalid: {
    title: 'This link isn&rsquo;t valid',
    detail: 'It may have been cut off by your email app. Enter your email again for a new one.',
    status: 404,
  },
  failed: {
    title: 'Something went wrong',
    detail: 'Your link wasn&rsquo;t used up. Try the button again, or request a new one.',
    status: 500,
  },
}

function errorPage(kind: keyof typeof COPY): NextResponse {
  const c = COPY[kind]
  return html(
    `<h2>${c.title}</h2><p class="muted">${c.detail}</p>` +
      `<p style="margin-top:24px"><a href="/auth/login">Back to sign in</a></p>`,
    c.status
  )
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (request.nextUrl.searchParams.get('e') === 'failed') return errorPage('failed')

  const admin = createAdminClient()
  const { data } = await admin
    .from('login_links')
    .select('expires_at, consumed_at')
    .eq('token_hash', hashHandoffToken(token))
    .maybeSingle()

  const state = classifyHandoff((data ?? null) as HandoffRow | null, Date.now())
  if (state !== 'valid') return errorPage(state)

  return html(
    `<h2>Sign in to HAEVN</h2>` +
      `<p class="muted">Press the button to finish signing in.</p>` +
      `<form method="POST" action="/api/auth/login-link/consume">` +
      `<input type="hidden" name="token" value="${escapeHtml(token)}">` +
      `<button class="btn" type="submit">Sign me in</button>` +
      `</form>` +
      `<p class="muted" style="margin-top:24px">This link works once. Opening this page hasn&rsquo;t used it up.</p>`
  )
}
