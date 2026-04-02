import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = 'HAEVN <notifications@haevn.co>'

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: any }> {
  if (!process.env.RESEND_API_KEY) {
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
