import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashHandoffToken, buildHandoffUrl, IMPERSONATION_BASE } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Redeem an impersonation handoff — the ONLY place a sign-in link is created.
 *
 * POST-only by design (2026-08-25 incident): every automated GET in the admin's
 * browser/network path burned the old magic link within ~2s of generation, so
 * the human always got "expired". A scanner does not POST forms. The magic link
 * now comes into existence here, after a human click, and leaves in a 303
 * Location header — never in a response body, the DOM, a log line, or a
 * clipboard. It exists for exactly one redirect.
 *
 * NOT under /api/admin on purpose: it must work from a Chrome guest profile
 * with no session. The 256-bit token is the authorisation; the audit row that
 * authorised it was written at generation time, before this URL existed.
 *
 * Single-use is the atomic conditional UPDATE below — one statement, so two
 * concurrent POSTs cannot both win.
 */

/**
 * Stay on whatever host the flow started on — localhost, a preview deployment,
 * or www in production — so this is testable off prod. Host-header spoofing
 * can't point it anywhere interesting: an unrecognised host falls back to www,
 * and the redirect only ever reaches the browser that already holds the token.
 */
function originOf(request: NextRequest): string {
  const { origin, hostname } = new URL(request.url)
  const trusted =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'www.haevn.app' ||
    hostname.endsWith('.vercel.app')
  return trusted ? origin : IMPERSONATION_BASE
}

/** Bounce back to the landing page, which explains the state. Never leaks why here. */
function backToLanding(request: NextRequest, token: string, failed = false): NextResponse {
  const url = buildHandoffUrl(token, originOf(request)) + (failed ? '?e=failed' : '')
  return NextResponse.redirect(url, 303)
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
  // First hop only — Vercel prepends the client IP. No new infra needed.
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null

  // ── THE single-use gate: one statement, consumes only if unconsumed AND live. ──
  const { data: claimed, error: claimErr } = await admin
    .from('impersonation_log')
    .update({ consumed_at: nowIso, consumed_ip: ip })
    .eq('token_hash', hashHandoffToken(token))
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('id, target_user_id')

  if (claimErr) {
    console.error('[impersonate-consume] claim failed:', claimErr.message)
    return backToLanding(request, token, true)
  }
  // 0 rows = already used, expired, or never existed. The landing page GET
  // re-reads the row and names which one.
  if (!claimed || claimed.length !== 1) return backToLanding(request, token)

  const { id, target_user_id: targetUserId } = claimed[0] as { id: string; target_user_id: string }

  /** Put the handoff back if we can't finish — the admin should not lose it to our bug. */
  const rollback = async () => {
    await admin.from('impersonation_log').update({ consumed_at: null, consumed_ip: null }).eq('id', id)
  }

  const { data: userRes } = await admin.auth.admin.getUserById(targetUserId)
  const email = userRes?.user?.email
  if (!email) {
    console.error('[impersonate-consume] target has no email, target=', targetUserId.slice(0, 8))
    await rollback()
    return backToLanding(request, token, true)
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashedToken = (linkData as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  if (linkErr || !hashedToken) {
    console.error('[impersonate-consume] generateLink failed:', linkErr?.message ?? 'no hashed_token')
    await rollback()
    return backToLanding(request, token, true)
  }

  // Audit-visible, PII-free. The link itself is NEVER logged.
  console.log('[impersonate-consume] redeemed target=', targetUserId.slice(0, 8), 'ip=', ip ?? 'unknown')

  // One hop. /auth/confirm runs verifyOtp, sets sb-haevn-auth, and forwards to
  // the member's resume step (or /splash) — the same path the emailed CTA uses.
  return NextResponse.redirect(
    `${originOf(request)}/auth/confirm?token_hash=${hashedToken}&type=magiclink`,
    303
  )
}
