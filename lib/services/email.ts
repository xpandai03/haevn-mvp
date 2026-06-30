import { Resend } from 'resend'

// haevn.app is the Resend-verified sending domain. haevn.co was NOT verified
// and 403'd every send ("domain is not verified"), so all notification email
// silently failed. Must stay on a verified domain.
const FROM_ADDRESS = 'HAEVN <notifications@haevn.app>'

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: any }> {
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
    })

    if (error) {
      console.error('[Email] Send error:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error('[Email] Unexpected error:', error)
    return { success: false, error }
  }
}
