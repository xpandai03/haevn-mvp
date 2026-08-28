import { LOGIN_LINK_TTL_MINUTES } from './loginLink'

/**
 * The branded sign-in email. Goes out through our Resend sender on the verified
 * haevn.app domain (lib/services/email.ts), NOT through Supabase's SMTP — which
 * is why this flow generates its own link instead of using signInWithOtp.
 * Visual language matches the match-notification template.
 */
export function loginLinkEmail(url: string): { subject: string; html: string } {
  return {
    subject: 'Your HAEVN sign-in link',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #0F2A4A; margin-bottom: 16px;">Sign in to HAEVN</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          Tap below to sign in. No password needed — we&rsquo;ll take you straight to your matches.
        </p>
        <a href="${url}"
           style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: #008080; color: white; text-decoration: none; border-radius: 24px; font-weight: 500;">
          Sign in to HAEVN
        </a>
        <p style="color: #4a5568; font-size: 13px; line-height: 1.6; margin-top: 24px;">
          This link works once and expires in ${LOGIN_LINK_TTL_MINUTES} minutes.
          If it stops working, just request a new one from the sign-in page.
        </p>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 32px;">
          If you didn&rsquo;t ask to sign in, you can ignore this email — nothing will happen.
        </p>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 8px;">
          HAEVN — Meaningful connections, intentionally.
        </p>
      </div>
    `,
  }
}
