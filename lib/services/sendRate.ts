/**
 * Outbound send pacing + provider-error classification.
 *
 * WHY THIS EXISTS. The 2026-09-21 Monday run dispatched 555 notifications with
 * no pacing at all. Measured against the providers:
 *
 *   email peak  12/sec  -> 146 x rate_limit_exceeded (Resend allows 10/sec)
 *   email total 203     -> 205 x daily_quota_exceeded once the cap was hit
 *   SMS   peak  21/sec  -> ZERO rate-limit errors
 *
 * So email needs pacing and SMS does not. Twilio absorbed 21/sec without
 * complaint at this volume, and adding machinery it does not need would be cost
 * with no benefit — revisit only if SMS volume grows an order of magnitude.
 *
 * THE PACER IS A SPACED-SLOT QUEUE, not a token bucket. A bucket permits a burst
 * up to its capacity, and a burst is exactly what tripped the 10/sec limit: the
 * send loop runs at concurrency 8, so eight callers arrive at once. Spacing every
 * slot by 1/rate seconds makes bursting structurally impossible while leaving the
 * concurrency alone — the workers still overlap their awaits, they just cannot
 * hit the wire at the same instant.
 */

/** Sends per second. Default 5 — half of Resend's documented 10/sec ceiling,
 *  which leaves room for retries and for any other sender sharing the window. */
export const DEFAULT_SEND_RATE_PER_SEC = 5

export function sendRatePerSec(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseFloat(env.SEND_RATE_PER_SEC ?? '')
  // A bad value must never mean "unlimited" (0 or NaN would divide to Infinity
  // spacing or none at all), so it falls back to the documented default.
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SEND_RATE_PER_SEC
}

/** A pacer instance. Exposed as a class so tests can drive one deterministically. */
export class SendPacer {
  private nextSlotAt = 0
  private readonly spacingMs: number

  constructor(ratePerSec: number, private now: () => number = Date.now) {
    this.spacingMs = 1000 / Math.max(0.001, ratePerSec)
  }

  /** ms the caller must wait for its slot. Reserves the slot as a side effect. */
  reserve(): number {
    const t = this.now()
    const at = Math.max(t, this.nextSlotAt)
    this.nextSlotAt = at + this.spacingMs
    return at - t
  }

  /** Await this before every dispatch. */
  async acquire(): Promise<void> {
    const wait = this.reserve()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }

  /** Projected wall-clock seconds to dispatch `n` sends at this rate. */
  projectSeconds(n: number): number {
    return Math.max(0, (n - 1) * this.spacingMs) / 1000
  }
}

/**
 * Process-wide email pacer. Shared deliberately: the match phase and the ping
 * phase run inside the SAME Monday cron invocation and against the SAME Resend
 * account, so pacing them independently would still allow 2x the intended rate
 * at the wire.
 */
let emailPacer: SendPacer | null = null
export function getEmailPacer(): SendPacer {
  if (!emailPacer) emailPacer = new SendPacer(sendRatePerSec())
  return emailPacer
}
/** Tests only — drop the shared pacer so a fresh rate can be picked up. */
export function __resetEmailPacer(): void {
  emailPacer = null
}

// ─── provider error classification ──────────────────────────────────────────
/**
 * Why a send failed, and therefore what to do about it.
 *
 *  throttled  — provider said "too fast". Retryable NOW, with backoff.
 *  quota      — provider said "you are done for today". Retrying cannot succeed
 *               and would burn the run's time budget, so it never retries.
 *  invalid    — the destination is permanently unusable. Mark it so future runs
 *               stop trying and stop counting it as a failure.
 *  other      — anything else. Counted, not retried, not marked.
 */
export type SendFailureKind = 'throttled' | 'quota' | 'invalid' | 'other'

export function classifyEmailError(err: unknown): SendFailureKind {
  const m = errText(err)
  if (/daily_quota_exceeded|daily quota/i.test(m)) return 'quota'
  if (/rate_limit_exceeded|too many requests|\b429\b/i.test(m)) return 'throttled'
  if (/validation_error|invalid `?to`?|invalid recipient|invalid email/i.test(m)) return 'invalid'
  return 'other'
}

export function classifySmsError(err: unknown): SendFailureKind {
  const m = errText(err)
  // Twilio 21211/21614: the number cannot receive SMS. Permanent.
  if (/invalid ['"]?to['"]? phone number|21211|21614|not a valid phone number/i.test(m)) return 'invalid'
  if (/rate limit|too many requests|\b429\b|20429/i.test(m)) return 'throttled'
  return 'other'
}

function errText(err: unknown): string {
  if (!err) return ''
  if (typeof err === 'string') return err
  const e = err as any
  return String(e?.message ?? e?.error?.message ?? e?.name ?? JSON.stringify(e) ?? '')
}

/** Backoff before retry attempt `n` (1-based). 400ms, then 1200ms. */
export const RETRY_BACKOFF_MS = [400, 1200]
/** Throttled sends get this many retries before being counted failed. */
export const MAX_THROTTLE_RETRIES = 2
