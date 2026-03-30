import Twilio from 'twilio'

const client = Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function sendSMS(to: string, body: string) {
  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to,
    })

    return { success: true as const, sid: message.sid }
  } catch (error) {
    console.error('[Twilio] SMS send error:', error)
    return { success: false as const, error }
  }
}
