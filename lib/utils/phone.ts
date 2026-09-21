/**
 * Server-side phone normalization for member-supplied numbers.
 *
 * WHY. Until now nothing validated `partnerships.phone` on write. The only
 * normalization in the codebase was client-side, US-only, and inline in signup
 * step 4 (`+1${getDigits(phone)}`), so anything reaching the column by another
 * path landed verbatim. Production consequences, measured 2026-09-20/21:
 *
 *   - 2 rows held pure-alphabetic junk with no digits at all
 *   - 29 numbers were E.164-SHAPED but rejected by the carrier, burning a paced
 *     send slot every Monday and reading as a fresh failure each time
 *
 * The 29 are handled downstream by migration 058 (mark the channel invalid once
 * the carrier says so). This module handles the other half: stop obvious junk
 * entering the column in the first place.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not decide whether a number is
 * *reachable* — only a carrier can, and that answer arrives asynchronously.
 * Rejecting "shaped like a phone number but unassigned" here would mean
 * inventing a carrier database. This is a cheap structural gate, not validation
 * theatre.
 *
 * A REJECTION MUST NEVER BLOCK A SUBMISSION. Callers store `null` and carry on:
 * a member who mistypes their phone during onboarding still gets an account, a
 * profile, and email notifications. Losing the signup over a typo would be a
 * far worse outcome than losing one channel.
 */

/** Longest plausible E.164 subscriber number, per ITU-T E.164. */
const MAX_E164_DIGITS = 15
/** Shortest real international number. Below this it cannot be a phone number. */
const MIN_E164_DIGITS = 8

export interface NormalizedPhone {
  /** E.164 (`+15125550123`) when usable, otherwise null. */
  value: string | null
  /** Why it was rejected. `null` when accepted (or when input was blank). */
  reason: 'empty' | 'no_digits' | 'too_short' | 'too_long' | 'invalid_country' | null
}

/**
 * Normalize a member-supplied phone to E.164, or null.
 *
 * Accepts the shapes members actually type — `(512) 555-0123`, `512.555.0123`,
 * `+1 512 555 0123`, `00 44 20 …` — and a bare 10-digit US number, which is
 * what the signup form collects. Everything else normalizes or is rejected.
 */
export function normalizePhone(input: string | null | undefined): NormalizedPhone {
  const raw = String(input ?? '').trim()
  if (!raw) return { value: null, reason: 'empty' }

  // `00` is the international access prefix in much of the world — the member
  // typed a real international number, just not in E.164.
  const hadPlus = raw.startsWith('+') || raw.startsWith('00')
  const digits = raw.replace(/\D/g, '').replace(/^00/, '')

  if (!digits) return { value: null, reason: 'no_digits' }

  // A bare 10-digit number is the US/Canada form the signup field collects.
  // Only assume +1 when the member gave no country indication at all.
  if (!hadPlus && digits.length === 10) return { value: `+1${digits}`, reason: null }
  // 11 digits starting with 1 is a US number typed with its country code.
  if (!hadPlus && digits.length === 11 && digits.startsWith('1')) return { value: `+${digits}`, reason: null }

  if (digits.length < MIN_E164_DIGITS) return { value: null, reason: 'too_short' }
  if (digits.length > MAX_E164_DIGITS) return { value: null, reason: 'too_long' }
  // E.164 country codes never start with 0.
  if (digits.startsWith('0')) return { value: null, reason: 'invalid_country' }

  return { value: `+${digits}`, reason: null }
}

/** True when the stored value is already well-formed E.164. */
export function isE164(value: string | null | undefined): boolean {
  return /^\+[1-9]\d{7,14}$/.test(String(value ?? '').trim())
}

/**
 * What to WRITE for a member-supplied phone.
 *
 * Returns the normalized number, or null for anything unusable. Never throws
 * and never signals "reject the whole submission" — the caller stores whatever
 * comes back and continues.
 */
export function phoneForStorage(input: string | null | undefined): string | null {
  return normalizePhone(input).value
}
