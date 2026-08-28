import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashHandoffToken, HAEVN_BASE } from '@/lib/auth/handoff'
import { loginLinkUrl } from '@/lib/auth/loginLink'

export const dynamic = 'force-dynamic'

/**
 * Redeem a sign-in handoff — the ONLY place the magic link is created.
 *
 * POST-only by design: mail scanners GET, they do not submit forms. The magic
 * link comes into existence here, after a human press, and leaves in a 303
 * Location header — never in a response body, the DOM, or a log line.
 *
 * Single-use is the atomic conditional UPDATE below: one statement, so two
 * concurrent presses cannot both win.
 */

function originOf(request: NextRequest): string {
  const { origin, hostname } = new URL(request.url)
  const trusted =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'www.haevn.app' ||
    hostname.endsWith('.vercel.app')
  return trusted ? origin : HAEVN_BASE
}

function backToLanding(request: NextRequest, token: string, failed = false): NextResponse {
  return NextResponse.redirect(loginLinkUrl(token, originOf(request)) + (failed ? '?e=failed' : ''), 303)
}

export async function POST(request: NextRequest) {
  let token = ''
  try {
    const form = await request.formData()
    token = String(form.get('token') ?? '')
  } catch {
    /* no body */
  }
  if (!token) return NextResponse.redirect(`${originOf(request)}/auth/login`, 303)

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null

  // ── THE single-use gate: consumes only if unconsumed AND still live. ──
  const { data: claimed, error: claimErr } = await admin
    .from('login_links')
    .update({ consumed_at: nowIso, consumed_ip: ip })
    .eq('token_hash', hashHandoffToken(token))
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('id, user_id')

  if (claimErr) {
    console.error('[login-link-consume] claim failed:', claimErr.message)
    return backToLanding(request, token, true)
  }
  // 0 rows = already used, expired, or never existed. The landing GET names which.
  if (!claimed || claimed.length !== 1) return backToLanding(request, token)

  const { id, user_id: userId } = claimed[0] as { id: string; user_id: string | null }

  /** Put the handoff back if we can't finish — our bug shouldn't cost the member their link. */
  const rollback = async () => {
    await admin.from('login_links').update({ consumed_at: null, consumed_ip: null }).eq('id', id)
  }

  if (!userId) {
    console.error('[login-link-consume] row has no user_id')
    await rollback()
    return backToLanding(request, token, true)
  }

  const { data: userRes } = await admin.auth.admin.getUserById(userId)
  const email = userRes?.user?.email
  if (!email) {
    console.error('[login-link-consume] account has no email, user=', userId.slice(0, 8))
    await rollback()
    return backToLanding(request, token, true)
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const hashedToken = (linkData as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  if (linkErr || !hashedToken) {
    console.error('[login-link-consume] generateLink failed:', linkErr?.message ?? 'no hashed_token')
    await rollback()
    return backToLanding(request, token, true)
  }

  console.log('[login-link-consume] signed in user=', userId.slice(0, 8))

  // One hop. /auth/confirm runs verifyOtp, sets sb-haevn-auth, and forwards to
  // the member's resume step (or /splash) — the same handler the emailed match
  // CTA has always used. Unchanged by this PR.
  return NextResponse.redirect(
    `${originOf(request)}/auth/confirm?token_hash=${hashedToken}&type=magiclink`,
    303
  )
}
