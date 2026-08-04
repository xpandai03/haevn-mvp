import crypto from 'crypto'

/**
 * Manual Svix webhook signature verification (Resend uses Svix). No `svix`
 * dependency — matches the repo's existing manual-HMAC webhook pattern
 * (lemonsqueezy, veriff).
 *
 * Scheme (verified against Resend + Svix docs + the canonical Svix test vector):
 *   signed content = `${svix_id}.${svix_timestamp}.${rawBody}`
 *   secret         = `whsec_<base64>` — base64-decode the part AFTER the prefix
 *   signature      = base64(HMAC_SHA256(secretBytes, signedContent))
 *   svix-signature header = space-delimited list of `v<n>,<base64sig>`; a match
 *     against ANY `v1,` entry (constant-time) passes.
 *   Reject if svix-timestamp is outside ±toleranceSec (bounded replay guard).
 */

export interface SvixHeaders {
  svixId: string | null
  svixTimestamp: string | null
  svixSignature: string | null
}

/** Default replay-tolerance: 24h. The HMAC is the real security and the
 *  suppression write is idempotent, so a wide-but-BOUNDED window lets Svix's
 *  late retries (5s→5m→30m→2h→5h…) through without accepting unbounded replays. */
export const DEFAULT_SVIX_TOLERANCE_SEC = 86_400

export type SvixVerifyReason =
  | 'ok'
  | 'missing' // secret or a required header absent (fails closed)
  | 'bad_secret' // secret not base64-decodable
  | 'timestamp_stale' // signature scheme fine, but timestamp outside tolerance
  | 'signature_mismatch' // timestamp ok, no signature matched → wrong secret / tampered

export interface SvixVerifyResult {
  ok: boolean
  reason: SvixVerifyReason
  /** how far the svix-timestamp was from now, in seconds (for stale rejects). */
  staleSec?: number
}

/** Detailed verify — distinguishes WHY a webhook was rejected (for diagnostics). */
export function verifySvixSignatureDetailed(params: {
  secret: string
  headers: SvixHeaders
  rawBody: string
  nowSec?: number
  toleranceSec?: number
}): SvixVerifyResult {
  const { secret, headers, rawBody } = params
  const { svixId, svixTimestamp, svixSignature } = headers
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return { ok: false, reason: 'missing' }

  // Replay guard: timestamp within tolerance of now.
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000)
  const tol = params.toleranceSec ?? DEFAULT_SVIX_TOLERANCE_SEC
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'timestamp_stale', staleSec: NaN }
  const staleSec = nowSec - ts
  if (Math.abs(staleSec) > tol) return { ok: false, reason: 'timestamp_stale', staleSec }

  // Secret is `whsec_<base64>`; the signing key is the base64-decoded remainder.
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let keyBytes: Buffer
  try {
    keyBytes = Buffer.from(secretKey, 'base64')
  } catch {
    return { ok: false, reason: 'bad_secret' }
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
      return { ok: true, reason: 'ok' }
    }
  }
  // Timestamp was fine and nothing matched → wrong secret or tampered payload.
  return { ok: false, reason: 'signature_mismatch', staleSec }
}

/** Boolean wrapper (back-compat for existing callers/tests). */
export function verifySvixSignature(params: {
  secret: string
  headers: SvixHeaders
  rawBody: string
  nowSec?: number
  toleranceSec?: number
}): boolean {
  return verifySvixSignatureDetailed(params).ok
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
