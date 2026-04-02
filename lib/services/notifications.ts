import { sendSMS } from './twilio'
import { sendEmail } from './email'

// ─── Templates ──────────────────────────────────────────────────

const SMS_TEMPLATES = {
  match: 'Your new matches are ready on HAEVN! Log in to view them: https://haevn.co/dashboard/matches',
  message: (senderName: string) =>
    `${senderName} sent you a message on HAEVN. Log in to reply: https://haevn.co/chat`,
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
        <a href="https://haevn.co/dashboard/matches"
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
        <a href="https://haevn.co/chat"
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
}

/**
 * Send notification via all available channels (SMS + Email).
 * Fire-and-forget: never throws, never blocks the caller.
 * Sends SMS and email in parallel for speed.
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
  return result
}
