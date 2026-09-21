import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { isEmailSuppressed } from '@/lib/suppression/emailSuppressions'
import type { SendScope } from '@/lib/suppression/scope'
import {
  getEmailPacer, classifyEmailError, RETRY_BACKOFF_MS, MAX_THROTTLE_RETRIES,
  type SendFailureKind,
} from './sendRate'

// haevn.app is the Resend-verified sending domain. haevn.co was NOT verified
// and 403'd every send ("domain is not verified"), so all notification email
// silently failed. Must stay on a verified domain.
const FROM_ADDRESS = 'HAEVN <notifications@haevn.app>'

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

export interface SendEmailOpts {
  /**
   * Suppression scope for THIS send. Default 'critical' → NEVER suppressed
   * (magic-link sign-in, first-match notifications, and any un-tagged sender).
   * 'renotify' / 'all_noncritical' senders opt in to the suppression guard.
   */
  scope?: SendScope
  /** Extra headers passed to Resend (e.g. List-Unsubscribe on re-notify). */
  headers?: Record<string, string>
}

export interface SendEmailResult {
  success: boolean
  error?: any
  /** True when OUR suppression list blocked this send (not sent). */
  suppressed?: boolean
  /** Best-effort: true when RESEND's own suppression/rejection surfaced in the error. */
  resendSuppressed?: boolean
  /**
   * Why it failed, so the Monday readout can separate "we sent too fast"
   * (fixable by pacing) from "the plan is exhausted" (fixable only by a bigger
   * plan) from "this address will never work" (fixable by marking it).
   */
  failureKind?: SendFailureKind
  /** Throttle retries consumed before this result. 0 on a first-attempt success. */
  retries?: number
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: SendEmailOpts
): Promise<SendEmailResult> {
  const scope = opts?.scope ?? 'critical'

  // Single choke point: any non-critical send is checked against our suppression
  // list before it ever reaches Resend. Critical sends skip the check entirely
  // (no DB read) so magic links / match notifications can never be suppressed.
  if (scope !== 'critical') {
    try {
      if (await isEmailSuppressed(createAdminClient(), to, scope)) {
        return { success: false, error: 'suppressed', suppressed: true }
      }
    } catch (e) {
      // A transient suppression-check failure must not silence a whole run; the
      // re-notify audience build already filtered suppressed addresses upstream.
      console.warn('[Email] suppression check failed, proceeding:', (e as any)?.message)
    }
  }

  const resend = getResendClient()
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set — skipping')
    return { success: false, error: 'API key not configured' }
  }

  // PACED, PROCESS-WIDE. The send loop runs at concurrency 8, so without this
  // eight callers reach the wire together and trip Resend's 10/sec limit — which
  // is exactly what produced 146 failures on 2026-09-21.
  const pacer = getEmailPacer()

  let retries = 0
  for (let attempt = 0; ; attempt++) {
    await pacer.acquire()
    try {
      const { error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
        ...(opts?.headers ? { headers: opts.headers } : {}),
      })

      if (!error) return { success: true, retries }

      const kind = classifyEmailError(error)

      // A throttle is transient: back off and try again. A QUOTA is not — it
      // cannot succeed again today, and retrying it would burn the run's time
      // budget on sends that are already lost. It fails immediately, loudly,
      // and distinctly so the readout can say "plan exhausted" rather than
      // "unknown error".
      if (kind === 'throttled' && attempt < MAX_THROTTLE_RETRIES) {
        retries++
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt] ?? 1200))
        continue
      }

      // Best-effort: distinguish "Resend refused (their suppression list)" from
      // a generic failure, so the readout can tell it apart from our-layer skip.
      const msg = typeof error === 'string' ? error : (error as any)?.message || ''
      const resendSuppressed = /suppress|suppression/i.test(msg)
      if (kind === 'quota') console.error('[Email] DAILY QUOTA EXHAUSTED — remaining sends this run will fail:', msg)
      else console.error('[Email] Send error:', error)
      return { success: false, error, resendSuppressed, failureKind: kind, retries }
    } catch (error) {
      const kind = classifyEmailError(error)
      if (kind === 'throttled' && attempt < MAX_THROTTLE_RETRIES) {
        retries++
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt] ?? 1200))
        continue
      }
      console.error('[Email] Unexpected error:', error)
      return { success: false, error, failureKind: kind, retries }
    }
  }
}
