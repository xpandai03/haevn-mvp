/**
 * Handoff-token primitives, shared by the two flows that must never mail or hand
 * out a live credential: admin impersonation (053 / PR #27) and self-serve
 * magic-link sign-in (054).
 *
 * THE PATTERN, and why it exists:
 *   A single-use Supabase magic link is burned by the first machine that GETs
 *   it. During the 2026-08-25 impersonation incident the token was redeemed
 *   1.6-2.7s after generation, every time — so the human always arrived second
 *   and saw "expired". Mail clients are more aggressive about this than
 *   browsers, so a link EMAILED to a member is at even greater risk.
 *
 *   So neither flow hands out a magic link. Each hands out an opaque 256-bit
 *   handoff token whose landing page is a plain GET that consumes nothing. The
 *   magic link is generated server-side only on an explicit POST and lives for
 *   exactly one redirect. A scanner can fetch the landing page all day and burn
 *   nothing, because a scanner does not submit forms.
 *
 * Only the token HASH is ever persisted; the raw token exists only in the URL.
 */

import { createHash, randomBytes } from 'crypto'

/**
 * Always www. The apex 307s to www and drops headers on the way (the trap that
 * burned the Resend webhook). Guarded by tests in both flows.
 */
export const HAEVN_BASE = 'https://www.haevn.app'

/** 256 bits of entropy, hex. This is the whole credential — treat it as one. */
export function newHandoffToken(): string {
  return randomBytes(32).toString('hex')
}

/** What we persist. One-way: the DB never holds anything that can sign anyone in. */
export function hashHandoffToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Rate-limit / lookup key for an email. NEVER store the address itself. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

/** Normalised form used for account lookup — members type their own casing. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** The subset of a handoff row the consume path reasons about. */
export interface HandoffRow {
  expires_at: string | null
  consumed_at: string | null
}

export type HandoffState = 'valid' | 'used' | 'expired' | 'invalid'

/**
 * Three distinct failure states, never a catch-all. "used" wins over "expired"
 * because an already-redeemed link is the more accurate story to tell.
 */
export function classifyHandoff(row: HandoffRow | null, nowMs: number): HandoffState {
  if (!row) return 'invalid'
  if (row.consumed_at) return 'used'
  if (!row.expires_at || Date.parse(row.expires_at) <= nowMs) return 'expired'
  return 'valid'
}
