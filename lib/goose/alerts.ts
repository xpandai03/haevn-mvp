/**
 * Goose operational alerts → the addresses in GOOSE_ALERT_EMAILS
 * (comma-separated; set in Vercel, never in code — this repo is public).
 *
 * Sent through the existing sendEmail choke point at scope 'critical', so the
 * suppression list can never swallow an ops alert. Content is ids, counts and
 * an error code only: no member names, emails or answers.
 */

import type { CohortRow, GooseErrorCode } from './types'

export type AlertKind = 'failure' | 'recovered' | 'exhausted'

/** (to, subject, html) → delivered? Injected so tests can observe sends. */
export type AlertTransport = (to: string, subject: string, html: string) => Promise<boolean>

export interface AlertContext {
  cohort: Pick<CohortRow, 'id' | 'goose_event_id' | 'event_name' | 'event_starts_at' | 'compute_attempts'>
  code?: GooseErrorCode
  expected?: number | null
  completed?: number | null
  detail?: Record<string, number | string>
}

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

export function parseAlertRecipients(raw: string | undefined | null): string[] {
  const out = new Set<string>()
  for (const part of (raw ?? '').split(',')) {
    const e = part.trim().toLowerCase()
    if (EMAIL_RE.test(e)) out.add(e)
  }
  return [...out]
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function buildAlertEmail(kind: AlertKind, ctx: AlertContext): { subject: string; html: string } {
  const name = ctx.cohort.event_name || ctx.cohort.goose_event_id
  const subject =
    kind === 'failure'
      ? `[HAEVN Goose] Compute failed: ${name}`
      : kind === 'recovered'
        ? `[HAEVN Goose] Recovered, Ready: ${name}`
        : `[HAEVN Goose] NOT READY at event start: ${name}`
  const lead =
    kind === 'failure'
      ? 'Compatibility processing for this event failed or came back incomplete. An automatic retry started at the same time as this email.'
      : kind === 'recovered'
        ? 'A retry succeeded. Every required pair is now present and the event reads Ready.'
        : 'The event has started and its compatibility dataset is still not complete. Automatic retries have stopped.'
  const rows: Array<[string, unknown]> = [
    ['Event', name],
    ['Goose event id', ctx.cohort.goose_event_id],
    ['HAEVN cohort id', ctx.cohort.id],
    ['Event starts', ctx.cohort.event_starts_at],
    ['Error code', ctx.code ?? '—'],
    ['Pairs expected', ctx.expected ?? '—'],
    ['Pairs completed', ctx.completed ?? '—'],
    ['Attempts so far', ctx.cohort.compute_attempts],
    ...Object.entries(ctx.detail ?? {}),
  ]
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">
<p>${esc(lead)}</p>
<table cellpadding="4" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#555">${esc(k)}</td><td><code>${esc(v)}</code></td></tr>`)
    .join('')}</table>
<p style="color:#555">Internal operational alert. Status is also visible to the event partner through the status endpoint.</p>
</div>`
  return { subject, html }
}

/** Default transport: the existing Resend path, critical scope. */
export const resendTransport: AlertTransport = async (to, subject, html) => {
  const { sendEmail } = await import('@/lib/services/email')
  const r = await sendEmail(to, subject, html, { scope: 'critical' })
  return r.success
}

/** Send one alert to every configured recipient. Returns how many were delivered. */
export async function sendGooseAlert(
  kind: AlertKind,
  ctx: AlertContext,
  transport: AlertTransport = resendTransport,
  recipientsRaw: string | undefined = process.env.GOOSE_ALERT_EMAILS
): Promise<{ recipients: number; delivered: number }> {
  const recipients = parseAlertRecipients(recipientsRaw)
  if (recipients.length === 0) {
    console.error('[goose] GOOSE_ALERT_EMAILS is not set — alert NOT sent:', kind, ctx.cohort.id, ctx.code)
    return { recipients: 0, delivered: 0 }
  }
  const { subject, html } = buildAlertEmail(kind, ctx)
  const results = await Promise.allSettled(recipients.map((to) => transport(to, subject, html)))
  const delivered = results.filter((r) => r.status === 'fulfilled' && r.value).length
  if (delivered < recipients.length) console.error(`[goose] alert ${kind} delivered ${delivered}/${recipients.length}`)
  return { recipients: recipients.length, delivered }
}
