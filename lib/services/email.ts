import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { isEmailSuppressed } from '@/lib/suppression/emailSuppressions'
import type { SendScope } from '@/lib/suppression/scope'

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

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      ...(opts?.headers ? { headers: opts.headers } : {}),
    })

    if (error) {
      // Best-effort: distinguish "Resend refused (their suppression list)" from
      // a generic failure, so the readout can tell it apart from our-layer skip.
      // Resend may not surface this distinctly — if not, it just reads as an error.
      const msg = typeof error === 'string' ? error : (error as any)?.message || ''
      const resendSuppressed = /suppress|suppression/i.test(msg)
      console.error('[Email] Send error:', error)
      return { success: false, error, resendSuppressed }
    }

    return { success: true }
  } catch (error) {
    console.error('[Email] Unexpected error:', error)
    return { success: false, error }
  }
}
