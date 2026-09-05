/**
 * Sign-in links for NOTIFICATION email/SMS — handoff tokens, never magic links.
 *
 * WHY THIS EXISTS. notify-matches used to call buildSignInUrl(), which mails a
 * raw single-use Supabase magic link. That is the exact pattern PR #27 and #29
 * were written to retire: mail clients and spam filters GET every URL in an
 * email, often within seconds, and a raw magic link is burned before the human
 * taps it. During the 2026-08-25 impersonation incident the token was redeemed
 * 1.6-2.7s after generation, every time. The member always arrives second and
 * sees "expired".
 *
 * That was survivable at 87 recipients. Opening release to all markets and
 * adding a weekly ping puts ~500 links a Monday through this path, so it would
 * manufacture "your link expired" at scale — for a cohort that has NEVER signed
 * in and has no password to fall back on.
 *
 * So both notification paths now issue the same opaque handoff token the
 * self-serve login flow uses (054): the emailed URL lands on an inert page that
 * consumes nothing, and the magic link is minted server-side only on an explicit
 * POST. A scanner can fetch it all day and burn nothing, because a scanner does
 * not submit forms.
 *
 * NO NEW TABLE, NO NEW LANDING PAGE. This writes a `login_links` row and returns
 * a /login-link/<token> URL — the same row shape and the same route the
 * self-serve flow already uses and tests.
 *
 * NO ACCOUNT IS EVER CREATED. The user id is resolved by the caller and passed
 * in; `admin.auth.admin.generateLink` (which silently creates users) is never
 * reached from here.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { newHandoffToken, hashHandoffToken, hashEmail, normalizeEmail } from './handoff'
import { loginLinkUrl } from './loginLink'

type Admin = ReturnType<typeof createAdminClient>

/**
 * TTL for a NOTIFICATION handoff — deliberately longer than the 15 minutes the
 * self-serve flow uses.
 *
 * Self-serve: the member asked for the link seconds ago and is watching for it,
 * so a short window is both safe and sufficient. A Monday notification is
 * different — it arrives unprompted at 8am and is realistically opened that
 * evening, or the next day. 15 minutes would expire before almost everyone.
 *
 * 72 hours covers "I saw it Monday, tapped it Wednesday" without leaving a live
 * credential sitting in an inbox for a full week. The token is still opaque,
 * still single-use, and still inert until an explicit POST — the TTL bounds an
 * already-guarded thing.
 *
 * A PARAMETER, NOT A LAW: if the client wants a different window, change it here.
 */
export const NOTIFY_SIGNIN_TTL_MS = 72 * 60 * 60 * 1000
export const NOTIFY_SIGNIN_TTL_HOURS = 72

/**
 * Mint a handoff sign-in URL for a known user. Returns null if the row cannot be
 * written — callers must then fall back to the plain login page rather than
 * emailing anything that could be mistaken for a credential.
 *
 * NOTE ON RATE LIMITS: rows written here also count toward the self-serve
 * per-email rate limit (3 per 15 minutes), because that limit counts
 * `login_links` rows. One cron-issued row per member per week only matters if
 * the member also requests self-serve links within 15 minutes of the Monday run,
 * where it costs them one of three attempts. Accepted deliberately — the
 * alternative is a second table whose only purpose is to dodge a counter.
 */
export async function issueNotifySignInUrl(
  admin: Admin,
  email: string,
  userId: string,
  now: Date = new Date()
): Promise<string | null> {
  try {
    const normalized = normalizeEmail(email)
    const token = newHandoffToken()
    const { error } = await admin.from('login_links').insert({
      token_hash: hashHandoffToken(token),
      email_hash: hashEmail(normalized),
      user_id: userId,
      request_ip: null,
      sent: true,
      expires_at: new Date(now.getTime() + NOTIFY_SIGNIN_TTL_MS).toISOString(),
    })
    if (error) {
      console.error('[notifySignIn] login_links insert failed:', error.message)
      return null
    }
    return loginLinkUrl(token)
  } catch (e) {
    console.error('[notifySignIn] threw:', (e as Error)?.message)
    return null
  }
}
