import { sendSMS } from './twilio'
import { sendEmail } from './email'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Base URL (never hardcode a domain) ────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  || process.env.NEXT_PUBLIC_SITE_URL
  || 'https://haevn-mvp.vercel.app'

// Branded base for user-facing PASSWORDLESS sign-in links. www.haevn.app is
// confirmed to serve /auth/confirm; the apex haevn.app 307-redirects to www, so
// point straight at www to skip a hop on the magic-link tap.
const SIGN_IN_BASE = 'https://www.haevn.app'

// ─── Templates ──────────────────────────────────────────────────

const SMS_TEMPLATES = {
  // Imported users have NO password, so the link is a per-user magic sign-in URL
  // (see buildSignInUrl). Launch-approved copy.
  match: (signInUrl: string) =>
    `HAEVN: Your matches are ready. We've found people who align with you on HAEVN. Tap to sign in (no password needed) and see who: ${signInUrl}`,
  message: (senderName: string) =>
    `${senderName} sent you a message on HAEVN. Log in to reply: ${BASE_URL}/chat`,
}

const EMAIL_TEMPLATES = {
  match: (signInUrl: string) => ({
    subject: 'You have new matches on HAEVN',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #0F2A4A; margin-bottom: 16px;">Your matches are ready</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          We've found people who align with you on HAEVN. Tap below to sign in (no password needed) and see who.
        </p>
        <a href="${signInUrl}"
           style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: #008080; color: white; text-decoration: none; border-radius: 24px; font-weight: 500;">
          Sign in to HAEVN
        </a>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 32px;">
          HAEVN — Meaningful connections, intentionally.
        </p>
      </div>
    `,
  }),
  message: (senderName: string) => ({
    subject: `New message from ${senderName} on HAEVN`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #0F2A4A; margin-bottom: 16px;">You have a new message</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          <strong>${senderName}</strong> sent you a message. Log in to read and reply.
        </p>
        <a href="${BASE_URL}/chat"
           style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: #008080; color: white; text-decoration: none; border-radius: 24px; font-weight: 500;">
          Open Chat
        </a>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 32px;">
          HAEVN — Meaningful connections, intentionally.
        </p>
      </div>
    `,
  }),
}

// ─── Core Dispatcher ────────────────────────────────────────────

interface NotificationOptions {
  type: 'match' | 'message'
  phone?: string | null
  email?: string | null
  senderName?: string
  /** Partnership ID for tracking (optional) */
  partnershipId?: string
  /** Per-user passwordless magic sign-in URL for the match CTA (see buildSignInUrl). */
  signInUrl?: string
}

/**
 * Build a per-user passwordless sign-in URL (token_hash magic link -> /auth/confirm).
 * Imported users have no password, so the SMS/email CTA must log them straight in.
 * Returns null if a link can't be generated (no email / Supabase error) so the
 * caller can decide how to handle it. Single-use; subject to the project's
 * email-link expiry (extend "Email OTP Expiration" in Supabase Auth for SMS taps
 * that may happen hours later).
 */
export async function buildSignInUrl(email: string): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (error) {
      console.error('[Notification] generateLink failed:', error.message)
      return null
    }
    const hash = (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
    if (!hash) return null
    return `${SIGN_IN_BASE}/auth/confirm?token_hash=${hash}&type=magiclink`
  } catch (e) {
    console.error('[Notification] buildSignInUrl error:', e)
    return null
  }
}

/**
 * Send notification via all available channels (SMS + Email).
 * Fire-and-forget: never throws, never blocks the caller.
 * Sends SMS and email in parallel for speed.
 * Logs each attempt to system_events for admin visibility.
 */
export async function sendNotification(opts: NotificationOptions): Promise<{
  sms: { sent: boolean; error?: any }
  email: { sent: boolean; error?: any }
}> {
  const result = {
    sms: { sent: false } as { sent: boolean; error?: any },
    email: { sent: false } as { sent: boolean; error?: any },
  }

  const senderName = opts.senderName || 'Someone'

  // Build messages based on type. Match CTA = the per-user magic sign-in URL
  // (passwordless). Fallback to the login page only if no link was generated.
  const matchSignInUrl = opts.signInUrl || `${SIGN_IN_BASE}/auth/login`
  const smsBody =
    opts.type === 'match'
      ? SMS_TEMPLATES.match(matchSignInUrl)
      : SMS_TEMPLATES.message(senderName)

  const emailTemplate =
    opts.type === 'match'
      ? EMAIL_TEMPLATES.match(matchSignInUrl)
      : EMAIL_TEMPLATES.message(senderName)

  // Send in parallel
  const promises: Promise<void>[] = []

  // SMS
  if (opts.phone) {
    promises.push(
      sendSMS(opts.phone, smsBody)
        .then((r) => {
          result.sms.sent = r.success
          if (!r.success) result.sms.error = r.error
        })
        .catch((err) => {
          result.sms.error = err
          console.error('[Notification] SMS error:', err)
        })
    )
  }

  // Email
  if (opts.email) {
    promises.push(
      sendEmail(opts.email, emailTemplate.subject, emailTemplate.html)
        .then((r) => {
          result.email.sent = r.success
          if (!r.success) result.email.error = r.error
        })
        .catch((err) => {
          result.email.error = err
          console.error('[Notification] Email error:', err)
        })
    )
  }

  await Promise.allSettled(promises)

  console.log(`[Notification] type=${opts.type} sms=${result.sms.sent} email=${result.email.sent}`)

  // Log to system_events (fire-and-forget, never block)
  logNotificationEvent(opts, result).catch(() => {})

  return result
}

// ─── Event Logging ──────────────────────────────────────────────

/** Serialize provider errors to a readable string (Resend/Twilio errors are
 *  plain objects that String() turns into "[object Object]"). */
export function serializeNotifyError(err: unknown): string | null {
  if (err == null) return null
  if (typeof err === 'string') return err
  try {
    const o: any = JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err as object)))
    if (o?.message) {
      return `${o.name || 'Error'}: ${o.message}${o.statusCode ? ` (${o.statusCode})` : ''}`
    }
    return JSON.stringify(o)
  } catch {
    return String(err)
  }
}

async function logNotificationEvent(
  opts: NotificationOptions,
  result: { sms: { sent: boolean; error?: any }; email: { sent: boolean; error?: any } }
) {
  try {
    const admin = createAdminClient()
    await admin.from('system_events').insert({
      event_type: 'notification_sent',
      triggered_by: 'system',
      metadata: {
        notification_type: opts.type,
        partnership_id: opts.partnershipId || null,
        phone: opts.phone ? `...${opts.phone.slice(-4)}` : null, // mask for privacy
        email: opts.email || null,
        sms_sent: result.sms.sent,
        sms_error: serializeNotifyError(result.sms.error),
        email_sent: result.email.sent,
        email_error: serializeNotifyError(result.email.error),
      },
    })
  } catch (err) {
    console.error('[Notification] Failed to log event:', err)
  }
}
