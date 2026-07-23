/**
 * Re-notification job — build audience, resolve channel, apply suppression, then
 * either dry-run-log (default) or send-and-log. Reuses the existing provider
 * wrappers (sendSMS/sendEmail/buildSignInUrl); does NOT touch the notify flow.
 *
 * Ships behind RENOTIFY_ENABLED. Default (false) → dry_run: NO provider is called.
 *
 * Split into a DB orchestrator (runReNotify) and a pure, injectable core
 * (processAudience) so the send/suppression/idempotency logic is unit-testable
 * with a spy sender and no database.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/services/twilio'
import { sendEmail } from '@/lib/services/email'
import { buildSignInUrl } from '@/lib/services/notifications'
import { buildAudience, getLoggedInUserIds, type AudienceEntry } from './audience'
import { renotifyEmail, renotifySms } from './copy'

type Admin = ReturnType<typeof createAdminClient>

/** Max consecutive Monday sends before a partnership is capped (client-tunable). */
export const MAX_RENOTIFY_SENDS = 8

/** Injectable so tests can spy and assert dry-run calls nothing. */
export interface Sender {
  sendSMS: (to: string, body: string) => Promise<{ success: boolean; error?: any }>
  sendEmail: (to: string, subject: string, html: string) => Promise<{ success: boolean; error?: any }>
  buildSignInUrl: (email: string) => Promise<string | null>
}

const realSender: Sender = { sendSMS, sendEmail, buildSignInUrl }

type ChannelStatus = 'sent' | 'failed' | 'planned' | 'skipped' | null

export interface RenotifyRowResult {
  partnershipId: string
  variant: string | null
  channels: string[]
  smsStatus: ChannelStatus
  emailStatus: ChannelStatus
  suppressedReason: 'login_detected' | 'cap_reached' | null
  sendCount: number
}

export interface RenotifyResult {
  runDate: string
  dryRun: boolean
  eligible: number
  sent: { sms: number; email: number }
  suppressed: { login_detected: number; cap_reached: number }
  failures: number
  rows: RenotifyRowResult[]
}

/** A persisted audit row. */
export interface RenotifyLogRow {
  partnership_id: string
  run_date: string
  dry_run: boolean
  variant: string | null
  channels_attempted: string[]
  sms_status: ChannelStatus
  email_status: ChannelStatus
  suppressed_reason: 'login_detected' | 'cap_reached' | null
  send_count: number
}

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10)
}

// ── pure, injectable core ────────────────────────────────────────────────────

/**
 * Process an already-built audience: for each entry, apply the cap, plan the
 * channels, send (unless dryRun), and hand a log row to `log`. No DB, no globals
 * — `sender` and `log` are injected. This is where idempotency/cap/channel/dry-run
 * behaviour lives and is tested.
 */
export async function processAudience(params: {
  audience: AudienceEntry[]
  sender: Sender
  dryRun: boolean
  runDate: string
  /** prior REAL (non-dry-run) sends per partnership — for the cap. */
  priorSendCount: Map<string, number>
  /** partnerships already really-sent this run_date — skipped (idempotency). */
  alreadySent: Set<string>
  log: (row: RenotifyLogRow) => Promise<void>
}): Promise<RenotifyResult> {
  const { audience, sender, dryRun, runDate, priorSendCount, alreadySent, log } = params

  const result: RenotifyResult = {
    runDate,
    dryRun,
    eligible: audience.length,
    sent: { sms: 0, email: 0 },
    suppressed: { login_detected: 0, cap_reached: 0 },
    failures: 0,
    rows: [],
  }

  for (const entry of audience) {
    // Idempotency: a real send already went out this Monday → leave it untouched.
    if (alreadySent.has(entry.partnershipId)) continue

    const sendCount = priorSendCount.get(entry.partnershipId) ?? 0
    const row = await processEntry(sender, entry, dryRun, sendCount)

    await log({
      partnership_id: entry.partnershipId,
      run_date: runDate,
      dry_run: dryRun,
      variant: row.variant,
      channels_attempted: row.channels,
      sms_status: row.smsStatus,
      email_status: row.emailStatus,
      suppressed_reason: row.suppressedReason,
      send_count: row.sendCount,
    })

    if (row.suppressedReason === 'login_detected') result.suppressed.login_detected++
    else if (row.suppressedReason === 'cap_reached') result.suppressed.cap_reached++
    if (row.smsStatus === 'sent') result.sent.sms++
    if (row.emailStatus === 'sent') result.sent.email++
    if (row.smsStatus === 'failed' || row.emailStatus === 'failed') result.failures++
    result.rows.push(row)
  }

  return result
}

async function processEntry(
  sender: Sender,
  entry: AudienceEntry,
  dryRun: boolean,
  sendCount: number
): Promise<RenotifyRowResult> {
  // ── send-time suppression: cap ──
  if (sendCount >= MAX_RENOTIFY_SENDS) {
    return {
      partnershipId: entry.partnershipId,
      variant: entry.variant,
      channels: [],
      smsStatus: null,
      emailStatus: null,
      suppressedReason: 'cap_reached',
      sendCount,
    }
  }

  const channels: string[] = []
  let smsStatus: ChannelStatus = null
  let emailStatus: ChannelStatus = null

  // Email (all variants) — each member email gets its own magic sign-in link.
  if (entry.memberEmails.length > 0) {
    channels.push('email')
    if (dryRun) {
      emailStatus = 'planned'
    } else {
      let anyOk = false
      let anyFail = false
      for (const email of entry.memberEmails) {
        const url = await sender.buildSignInUrl(email)
        if (!url) { anyFail = true; continue }
        const { subject, html } = renotifyEmail(url, entry.variant)
        const r = await sender.sendEmail(email, subject, html)
        r.success ? (anyOk = true) : (anyFail = true)
      }
      emailStatus = anyOk ? 'sent' : anyFail ? 'failed' : 'skipped'
    }
  }

  // SMS (has_phone only) → partnership phone, using the primary member's link.
  if (entry.variant === 'has_phone' && entry.phone) {
    channels.push('sms')
    if (dryRun) {
      smsStatus = 'planned'
    } else {
      const primaryEmail = entry.memberEmails[0]
      const url = primaryEmail ? await sender.buildSignInUrl(primaryEmail) : null
      if (!url) {
        smsStatus = 'failed'
      } else {
        const r = await sender.sendSMS(entry.phone, renotifySms(url))
        smsStatus = r.success ? 'sent' : 'failed'
      }
    }
  } else if (entry.variant === 'has_phone') {
    smsStatus = 'skipped'
  }

  return {
    partnershipId: entry.partnershipId,
    variant: entry.variant,
    channels,
    smsStatus,
    emailStatus,
    suppressedReason: null,
    sendCount,
  }
}

// ── DB orchestrator ──────────────────────────────────────────────────────────

export async function runReNotify(opts?: {
  admin?: Admin
  sender?: Sender
  now?: Date
  /** Overrides RENOTIFY_ENABLED (tests / manual dry-run trigger). */
  enabled?: boolean
}): Promise<RenotifyResult> {
  const admin = opts?.admin ?? createAdminClient()
  const sender = opts?.sender ?? realSender
  const now = opts?.now ?? new Date()
  const runDate = utcDate(now)
  const enabled = opts?.enabled ?? process.env.RENOTIFY_ENABLED === 'true'
  const dryRun = !enabled

  // Login snapshot at job start (= send time for this single Monday run).
  const loggedIn = await getLoggedInUserIds(admin)
  const audience = await buildAudience(admin, loggedIn, now)
  const partnershipIds = audience.map((a) => a.partnershipId)

  // Prior REAL sends per partnership (cap) + already-sent this run (idempotency).
  const priorSendCount = new Map<string, number>()
  const alreadySent = new Set<string>()
  if (partnershipIds.length > 0) {
    const { data: logs } = await admin
      .from('renotify_log')
      .select('partnership_id, run_date, dry_run, sms_status, email_status')
      .in('partnership_id', partnershipIds)
    for (const r of (logs ?? []) as any[]) {
      const realSend = r.dry_run === false && (r.sms_status === 'sent' || r.email_status === 'sent')
      if (realSend) {
        priorSendCount.set(r.partnership_id, (priorSendCount.get(r.partnership_id) ?? 0) + 1)
        if (r.run_date === runDate) alreadySent.add(r.partnership_id)
      }
    }
  }

  return processAudience({
    audience,
    sender,
    dryRun,
    runDate,
    priorSendCount,
    alreadySent,
    log: async (row) => {
      // Promote-only audit; upsert keeps one row per (partnership, run_date).
      await admin.from('renotify_log').upsert(row, { onConflict: 'partnership_id,run_date' })
    },
  })
}
