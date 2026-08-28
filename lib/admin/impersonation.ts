/**
 * Impersonation core — pure and injectable so the audit-first ordering, the
 * "refuse without generating anything" rules, and the single-use/TTL semantics
 * are unit-tested with spies (no DB, no auth, no real link).
 *
 * ── WHY THIS IS A HANDOFF TOKEN AND NOT A MAGIC LINK (incident 2026-08-25) ──
 * The route used to hand the admin a Supabase magic link. In four separate
 * attempts the token was redeemed 1.6-2.7s after the audit row was written —
 * machine speed, not human speed. Something in the admin's browser/network path
 * GETs any URL it can see, so the human's click was always the SECOND open and
 * Supabase answered "Email link is invalid or has expired".
 *
 * So: generation produces NO credential. It produces an opaque 256-bit handoff
 * token whose landing page is a plain GET that does nothing. The magic link is
 * generated server-side only when a human POSTs the button, and lives for
 * exactly one redirect. There is nothing for a scanner to burn.
 *
 * INVARIANTS enforced here:
 *   - a reason is REQUIRED (no reason → nothing happens),
 *   - the audit row is written BEFORE the handoff URL is returned,
 *   - only the token HASH is ever persisted; the raw token is returned once,
 *   - the handoff is single-use and expires (TTL below).
 */

import { createHash, randomBytes } from 'crypto'

/**
 * Always www. The apex 307s to www and drops headers on the way (the same trap
 * that burned the Resend webhook). `handoffUrlIsSafe` guards this in tests.
 */
export const IMPERSONATION_BASE = 'https://www.haevn.app'

/** Handoff TTL. Ours, in code — independent of Supabase's OTP expiry, which
 *  now only has to cover the milliseconds between generateLink and the redirect. */
export const HANDOFF_TTL_MS = 15 * 60 * 1000

/** 256 bits of entropy, hex. This is the whole credential — treat it as one. */
export function newHandoffToken(): string {
  return randomBytes(32).toString('hex')
}

/** What we persist. One-way: the DB never holds anything that can sign anyone in. */
export function hashHandoffToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function buildHandoffUrl(token: string, base: string = IMPERSONATION_BASE): string {
  return `${base}/impersonate/${token}`
}

/** Guard for the apex-vs-www trap: a handoff URL must be https and on www. */
export function handoffUrlIsSafe(url: string): boolean {
  return url.startsWith('https://www.haevn.app/impersonate/')
}

// ─── Redemption classification ──────────────────────────────────────────────

/** The subset of the impersonation_log row the consume path reasons about. */
export interface HandoffRow {
  target_user_id: string
  expires_at: string | null
  consumed_at: string | null
}

export type HandoffState = 'valid' | 'used' | 'expired' | 'invalid'

/**
 * Three distinct failure states, never a catch-all — the previous flow funnelled
 * every failure into one Supabase string ("invalid or has expired") on a login
 * page that rendered no message at all, which is why the incident took a live
 * call to even notice.
 */
export function classifyHandoff(row: HandoffRow | null, nowMs: number): HandoffState {
  if (!row) return 'invalid'
  if (row.consumed_at) return 'used'
  if (!row.expires_at || Date.parse(row.expires_at) <= nowMs) return 'expired'
  return 'valid'
}

/** Copy shown on the landing page. Keyed by state so it can't drift per surface. */
export const HANDOFF_COPY: Record<Exclude<HandoffState, 'valid'> | 'failed', { title: string; detail: string }> = {
  expired: {
    title: 'This link has expired',
    detail: 'Sign-in links are good for 15 minutes. Generate a new one from the Users page.',
  },
  used: {
    title: 'This link was already used',
    detail: 'Each link signs in once. Generate a new one from the Users page.',
  },
  invalid: {
    title: 'This link is not valid',
    detail: 'Check that the whole link was copied, or generate a new one from the Users page.',
  },
  failed: {
    title: 'Could not complete the sign-in',
    detail: 'The link was not used up. Try the button again, or generate a new one from the Users page.',
  },
}

/** HTTP status per state, so machines reading the landing page get a real signal. */
export const HANDOFF_STATUS: Record<Exclude<HandoffState, 'valid'> | 'failed', number> = {
  expired: 410,
  used: 410,
  invalid: 404,
  failed: 500,
}

// ─── Generation ─────────────────────────────────────────────────────────────

export interface AuditRow {
  admin_email: string
  target_user_id: string
  reason: string
  token_hash: string
  expires_at: string
}

export interface ImpersonationDeps {
  /** target user id → email (null if not found). Existence check only — the
   *  email is NOT persisted and NOT returned. */
  resolveEmail: (userId: string) => Promise<string | null>
  /** append-only audit write. Must complete before the handoff URL is returned. */
  writeAudit: (row: AuditRow) => Promise<void>
  /** injectable for tests */
  randomToken?: () => string
  now?: () => number
}

export interface ImpersonationParams {
  adminEmail: string
  targetUserId: string
  reason: string
}

export type ImpersonationResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; error: string; status: number }

export async function runImpersonation(
  p: ImpersonationParams,
  deps: ImpersonationDeps
): Promise<ImpersonationResult> {
  const reason = (p.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'A reason is required for impersonation.', status: 400 }
  if (!p.targetUserId) return { ok: false, error: 'targetUserId is required.', status: 400 }

  const email = await deps.resolveEmail(p.targetUserId)
  if (!email) return { ok: false, error: 'Target user not found.', status: 404 }

  const token = (deps.randomToken ?? newHandoffToken)()
  const nowMs = (deps.now ?? Date.now)()
  const expiresAt = new Date(nowMs + HANDOFF_TTL_MS).toISOString()

  // ── AUDIT FIRST — the row exists before the admin holds anything usable. ──
  await deps.writeAudit({
    admin_email: p.adminEmail,
    target_user_id: p.targetUserId,
    reason,
    token_hash: hashHandoffToken(token),
    expires_at: expiresAt,
  })

  // The raw token is returned here and nowhere else — never logged, never stored.
  return { ok: true, url: buildHandoffUrl(token), expiresAt }
}
