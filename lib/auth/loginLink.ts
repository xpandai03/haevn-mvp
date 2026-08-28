/**
 * Self-serve magic-link sign-in — pure, injectable core.
 *
 * Most HAEVN members were imported from the marketing survey and have no
 * password; 558 have a completed survey and have never signed in. This is their
 * way in: type your email, get a link, click one button, you're in.
 *
 * THREE RULES THIS MODULE ENFORCES:
 *
 * 1. NO ACCOUNT ENUMERATION. Every input — known email, unknown email, or one
 *    over the rate limit — takes the same path, writes one row, and returns the
 *    same result. The caller cannot tell them apart, and neither can the UI.
 *
 * 2. NO ACCOUNTS ARE EVER CREATED. `admin.generateLink({type:'magiclink'})`
 *    SILENTLY CREATES the user when the email is unknown — verified against the
 *    live project (806 → 807 users on an unknown address). So the account must
 *    be resolved FIRST and generateLink only ever called for one that exists.
 *    That is why this flow does its own lookup instead of signInWithOtp.
 *
 * 3. NO CREDENTIAL IS EMAILED. What goes in the email is an opaque handoff
 *    token (see lib/auth/handoff.ts); the magic link is created only when the
 *    member presses the button. Mail clients prefetch links aggressively, and a
 *    raw magic link would be burned before the member ever clicked it.
 */

import { HAEVN_BASE, newHandoffToken, hashHandoffToken, hashEmail, normalizeEmail } from './handoff'

/** Our TTL. The member-facing number, stated in the email and on the page. */
export const LOGIN_LINK_TTL_MS = 15 * 60 * 1000
export const LOGIN_LINK_TTL_MINUTES = 15

/**
 * The project's Supabase "Email OTP Expiration" — confirmed 2026-08-28 as
 * 3600s. Recorded for the record only: with the handoff in front this governs
 * nothing the member ever sees, because the underlying magic link is generated
 * and redeemed inside a single redirect. Our own LOGIN_LINK_TTL is what the
 * member experiences and what the UI states.
 */
export const SUPABASE_OTP_EXPIRY_SECONDS = 3600

/** Rate limits. Deliberately generous per-email (typos, spam folder, resend). */
export const RATE_LIMIT = {
  perEmail: { max: 3, windowMs: 15 * 60 * 1000 },
  perIp: { max: 10, windowMs: 60 * 60 * 1000 },
} as const

export function loginLinkUrl(token: string, base: string = HAEVN_BASE): string {
  return `${base}/login-link/${token}`
}

/** Apex-vs-www guard: an emailed sign-in URL must be https and on www. */
export function loginLinkUrlIsSafe(url: string): boolean {
  return url.startsWith('https://www.haevn.app/login-link/')
}

/** Cheap shape check. Not validation theatre — just enough to skip obvious junk. */
export function looksLikeEmail(raw: string): boolean {
  const e = normalizeEmail(raw)
  return e.length >= 5 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// ─── Rate limiting ──────────────────────────────────────────────────────────

export interface AttemptCounts {
  /** rows for this email_hash inside RATE_LIMIT.perEmail.windowMs */
  email: number
  /** rows for this request_ip inside RATE_LIMIT.perIp.windowMs */
  ip: number
}

export type RateVerdict = { allowed: true } | { allowed: false; reason: 'email' | 'ip' }

export function checkRate(counts: AttemptCounts): RateVerdict {
  if (counts.email >= RATE_LIMIT.perEmail.max) return { allowed: false, reason: 'email' }
  if (counts.ip >= RATE_LIMIT.perIp.max) return { allowed: false, reason: 'ip' }
  return { allowed: true }
}

// ─── The request flow ───────────────────────────────────────────────────────

export interface LoginLinkRow {
  token_hash: string | null
  email_hash: string
  user_id: string | null
  request_ip: string | null
  sent: boolean
  expires_at: string | null
}

export interface LoginLinkDeps {
  /** email → user id, or null. Case-insensitive. NEVER creates. */
  findUserByEmail: (normalizedEmail: string) => Promise<string | null>
  /** counts inside the two rate-limit windows */
  countAttempts: (emailHash: string, ip: string | null) => Promise<AttemptCounts>
  /** one row per request, always */
  record: (row: LoginLinkRow) => Promise<void>
  /** branded Resend send, scope 'critical' so suppression never blocks sign-in */
  sendLink: (email: string, url: string) => Promise<void>
  randomToken?: () => string
  now?: () => number
}

/**
 * What actually happened. The ROUTE MUST NOT VARY ITS RESPONSE ON THIS — it is
 * for logging and tests only. Every outcome renders the same "check your email".
 */
export type LoginLinkOutcome = 'sent' | 'no_account' | 'rate_limited' | 'invalid_email'

export async function requestLoginLink(
  rawEmail: string,
  ip: string | null,
  deps: LoginLinkDeps
): Promise<LoginLinkOutcome> {
  if (!looksLikeEmail(rawEmail)) return 'invalid_email'

  const email = normalizeEmail(rawEmail)
  const emailHash = hashEmail(email)
  const nowMs = (deps.now ?? Date.now)()

  const counts = await deps.countAttempts(emailHash, ip)
  const verdict = checkRate(counts)

  const base: LoginLinkRow = {
    token_hash: null,
    email_hash: emailHash,
    user_id: null,
    request_ip: ip,
    sent: false,
    expires_at: null,
  }

  if (!verdict.allowed) {
    await deps.record(base)
    return 'rate_limited'
  }

  // Resolve the account BEFORE any link exists. generateLink would create one.
  const userId = await deps.findUserByEmail(email)
  if (!userId) {
    // Row still written: keeps the counters honest and the path identical.
    await deps.record(base)
    return 'no_account'
  }

  const token = (deps.randomToken ?? newHandoffToken)()
  const expiresAt = new Date(nowMs + LOGIN_LINK_TTL_MS).toISOString()

  await deps.record({
    ...base,
    token_hash: hashHandoffToken(token),
    user_id: userId,
    sent: true,
    expires_at: expiresAt,
  })

  await deps.sendLink(email, loginLinkUrl(token))
  return 'sent'
}
