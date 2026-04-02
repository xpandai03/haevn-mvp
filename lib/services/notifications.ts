import { sendSMS } from './twilio'
import { sendEmail } from './email'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Base URL (never hardcode a domain) ────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  || process.env.NEXT_PUBLIC_SITE_URL
  || 'https://haevn-mvp.vercel.app'

// ─── Templates ──────────────────────────────────────────────────

const SMS_TEMPLATES = {
  match: `Your new matches are ready on HAEVN! Log in to view them: ${BASE_URL}/dashboard/matches`,
  message: (senderName: string) =>
    `${senderName} sent you a message on HAEVN. Log in to reply: ${BASE_URL}/chat`,
}

const EMAIL_TEMPLATES = {
  match: {
    subject: 'You have new matches on HAEVN',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #0F2A4A; margin-bottom: 16px;">New matches are waiting</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Your latest matches are ready to view. Log in to see who you've been matched with this week.
        </p>
        <a href="${BASE_URL}/dashboard/matches"
           style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: #008080; color: white; text-decoration: none; border-radius: 24px; font-weight: 500;">
          View Matches
        </a>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 32px;">
          HAEVN — Meaningful connections, intentionally.
        </p>
      </div>
    `,
  },
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

  // Build messages based on type
  const smsBody =
    opts.type === 'match'
      ? SMS_TEMPLATES.match
      : SMS_TEMPLATES.message(senderName)

  const emailTemplate =
    opts.type === 'match'
      ? EMAIL_TEMPLATES.match
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
        sms_error: result.sms.error ? String(result.sms.error) : null,
        email_sent: result.email.sent,
        email_error: result.email.error ? String(result.email.error) : null,
      },
    })
  } catch (err) {
    console.error('[Notification] Failed to log event:', err)
  }
}
