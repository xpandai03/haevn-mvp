import crypto from 'crypto'

/**
 * Unsubscribe token — HMAC over the (lowercased) email + fixed 'renotify' scope.
 * No login required; not forgeable (HMAC secret) and not enumerable (you can't
 * mint another address's token without the secret). Idempotent action, so the
 * token never expires and needs no invalidation.
 *
 *   token = base64url(emailLower) + '.' + base64url(HMAC_SHA256(secret, `${emailLower}:renotify`))
 */

const SCOPE = 'renotify' as const

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(emailLower: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${emailLower}:${SCOPE}`).digest('base64url')
}

export function makeUnsubToken(email: string, secret: string): string {
  const emailLower = email.trim().toLowerCase()
  return `${b64url(emailLower)}.${sign(emailLower, secret)}`
}

/**
 * Verify a token. Returns the email on success, or null on any tampering /
 * malformed input. Constant-time signature comparison.
 */
export function verifyUnsubToken(token: string, secret: string): { email: string } | null {
  if (!token || !secret) return null
  const dot = token.indexOf('.')
  if (dot === -1) return null
  const emailPart = token.slice(0, dot)
  const sigPart = token.slice(dot + 1)
  let emailLower: string
  try {
    emailLower = Buffer.from(emailPart, 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (!emailLower || !emailLower.includes('@')) return null

  const expected = sign(emailLower, secret)
  const a = Buffer.from(sigPart)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return { email: emailLower }
}
