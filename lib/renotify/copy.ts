/**
 * Re-notification copy — transactional match nudge, two variants. Edit here.
 *
 * Rules (client-directed): short, branded, a magic sign-in CTA, and NEVER reveal
 * match identities/names. The no-phone variant additionally asks the member to add
 * a phone number so future Match Mondays can text them.
 */

export type RenotifyVariant = 'has_phone' | 'no_phone'

/** SMS body (has_phone only). Kept under ~160 chars. */
export function renotifySms(signInUrl: string): string {
  return `HAEVN: you have matches waiting. Tap to view — you'll be signed in automatically: ${signInUrl}`
}

/** Email — subject + HTML. `askForPhone` adds the add-a-number line (no-phone variant). */
export function renotifyEmail(
  signInUrl: string,
  variant: RenotifyVariant,
  unsubUrl?: string
): { subject: string; html: string } {
  const askForPhone = variant === 'no_phone'
  const phoneLine = askForPhone
    ? `<p style="margin:16px 0 0;font-size:14px;color:#4A4A42;">
         Want a text next time? <strong>Add your mobile number</strong> in your profile
         and we'll text you when new matches are ready.
       </p>`
    : ''

  const html = `
  <div style="font-family:Outfit,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1E2A4A;">
    <h1 style="font-size:20px;margin:0 0 8px;color:#008080;">You have matches waiting</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#31312C;">
      Your HAEVN matches are ready to view. Tap below — you'll be signed in automatically.
    </p>
    <p style="margin:0 0 8px;">
      <a href="${signInUrl}"
         style="display:inline-block;background:#008080;color:#fff;text-decoration:none;
                padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
        View my matches
      </a>
    </p>
    ${phoneLine}
    <p style="margin:24px 0 0;font-size:12px;color:#9C9C91;">
      You're receiving this because you have matches you haven't viewed yet.
      This link signs you in and stops these reminders.
    </p>
    ${unsubUrl
      ? `<p style="margin:12px 0 0;font-size:12px;color:#9C9C91;">
           Don't want these weekly reminders?
           <a href="${unsubUrl}" style="color:#9C9C91;text-decoration:underline;">Unsubscribe</a>.
           You'll still be notified about genuinely new matches.
         </p>`
      : ''}
  </div>`.trim()

  return { subject: 'Your HAEVN matches are waiting', html }
}
