import crypto from 'crypto'

/**
 * Manual Svix webhook signature verification (Resend uses Svix). No `svix`
 * dependency — matches the repo's existing manual-HMAC webhook pattern
 * (lemonsqueezy, veriff).
 *
 * Scheme (verified against Resend + Svix docs, Aug 2026):
 *   signed content = `${svix_id}.${svix_timestamp}.${rawBody}`
 *   secret         = `whsec_<base64>` — base64-decode the part AFTER the prefix
 *   signature      = base64(HMAC_SHA256(secretBytes, signedContent))
 *   svix-signature header = space-delimited list of `v<n>,<base64sig>`; a match
 *     against ANY `v1,` entry (constant-time) passes.
 *   Reject if svix-timestamp is outside ±toleranceSec (replay guard).
 */

export interface SvixHeaders {
  svixId: string | null
  svixTimestamp: string | null
  svixSignature: string | null
}

export function verifySvixSignature(params: {
  secret: string
  headers: SvixHeaders
  rawBody: string
  nowSec?: number
  toleranceSec?: number
}): boolean {
  const { secret, headers, rawBody } = params
  const { svixId, svixTimestamp, svixSignature } = headers
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false

  // Replay guard: timestamp within tolerance of now.
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000)
  const tol = params.toleranceSec ?? 300
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > tol) return false

  // Secret is `whsec_<base64>`; the signing key is the base64-decoded remainder.
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let keyBytes: Buffer
  try {
    keyBytes = Buffer.from(secretKey, 'base64')
  } catch {
    return false
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', keyBytes).update(signedContent).digest('base64')
  const expectedBuf = Buffer.from(expected)

  // svix-signature = space-delimited `v1,<sig> v1,<sig2> ...`
  for (const part of svixSignature.split(' ')) {
    const comma = part.indexOf(',')
    if (comma === -1) continue
    const version = part.slice(0, comma)
    const sig = part.slice(comma + 1)
    if (version !== 'v1') continue
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return true
    }
  }
  return false
}

/** Build a valid Svix signature — used by tests (and never in prod). */
export function signSvix(secret: string, svixId: string, svixTimestamp: string, rawBody: string): string {
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = Buffer.from(secretKey, 'base64')
  const sig = crypto
    .createHmac('sha256', keyBytes)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest('base64')
  return `v1,${sig}`
}
