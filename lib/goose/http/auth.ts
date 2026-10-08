/**
 * Bearer auth for /api/goose/* (contract v1.0 "Auth").
 *
 *   GOOSE_SHARED_SECRET unset  → 503, every route, closed (never open)
 *   header missing / wrong     → 401, empty body
 *   header matches             → proceed
 *
 * Constant-time: both sides are hashed to fixed-length digests before
 * timingSafeEqual, so neither the comparison nor an early length check leaks
 * anything about the secret. The presented token is never logged or echoed.
 */

import { createHash, timingSafeEqual } from 'crypto'

export type GooseAuthResult = 'ok' | 'unauthorized' | 'not_configured'

function digest(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest()
}

export function checkGooseAuth(authorization: string | null, secret: string | undefined = process.env.GOOSE_SHARED_SECRET): GooseAuthResult {
  if (!secret) return 'not_configured'
  const m = /^Bearer\s+(.+)$/.exec(authorization ?? '')
  const presented = m ? m[1].trim() : ''
  // Always compare (even when absent) so every 401 path costs the same.
  const match = timingSafeEqual(digest(presented), digest(secret))
  return match && presented.length > 0 ? 'ok' : 'unauthorized'
}
