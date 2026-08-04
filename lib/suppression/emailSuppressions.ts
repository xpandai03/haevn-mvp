import { createAdminClient } from '@/lib/supabase/admin'
import {
  escalateScope, scopeBlocks, scopeForReason,
  type SuppressionReason, type SendScope,
} from './scope'

type Admin = ReturnType<typeof createAdminClient>

export interface SuppressionRow {
  email: string
  reason: SuppressionReason
  scope: 'renotify' | 'all_noncritical'
  source: 'resend_webhook' | 'unsub_link'
  detail?: any
}

/**
 * Record (or escalate) a suppression. One row per address; escalates to the
 * stronger scope. Never de-escalates, never removes. Idempotent: a repeat of the
 * same event is a no-op merge.
 */
export async function recordSuppression(
  admin: Admin,
  input: { email: string; reason: SuppressionReason; source: 'resend_webhook' | 'unsub_link'; detail?: any }
): Promise<{ ok: boolean; escalated: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email.includes('@')) return { ok: false, escalated: false, error: 'invalid email' }
  const incomingScope = scopeForReason(input.reason)

  const { data: existing } = await admin
    .from('email_suppressions')
    .select('reason, scope, source, detail')
    .eq('email', email)
    .maybeSingle()

  let row: SuppressionRow & { updated_at?: string }
  let escalated = false
  if (!existing) {
    row = { email, reason: input.reason, scope: incomingScope, source: input.source, detail: input.detail ?? null }
  } else {
    const merged = escalateScope(existing.scope, incomingScope)
    escalated = merged !== existing.scope
    row = {
      email,
      // The stronger scope's reason/source wins; a weaker/equal event only
      // refreshes detail + updated_at (records that we saw it), keeps the reason.
      reason: escalated ? input.reason : existing.reason,
      scope: merged,
      source: escalated ? input.source : existing.source,
      detail: input.detail ?? existing.detail ?? null,
      updated_at: new Date().toISOString(),
    }
  }

  const { error } = await admin.from('email_suppressions').upsert(row, { onConflict: 'email' })
  if (error) {
    console.error('[suppression] upsert failed:', error.message)
    return { ok: false, escalated, error: error.message }
  }
  return { ok: true, escalated }
}

/** True if `email` is suppressed for a send tagged `sendScope`. Critical → always false (no DB read). */
export async function isEmailSuppressed(admin: Admin, email: string, sendScope: SendScope): Promise<boolean> {
  if (sendScope === 'critical') return false
  const { data } = await admin
    .from('email_suppressions')
    .select('scope')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (!data) return false
  return scopeBlocks(data.scope as 'renotify' | 'all_noncritical', sendScope)
}

/**
 * All emails that block a re-notify send (any suppression covers renotify).
 * Loaded once for the audience build.
 */
export async function getRenotifySuppressedEmails(admin: Admin): Promise<Set<string>> {
  const out = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('email_suppressions').select('email').range(from, from + 999)
    if (error || !data || data.length === 0) break
    for (const r of data as { email: string }[]) out.add(r.email.toLowerCase())
    if (data.length < 1000) break
  }
  return out
}

/** Counts for the admin readout. */
export async function getSuppressionCounts(
  admin: Admin
): Promise<{ total: number; byReason: { hard_bounce: number; complaint: number; unsubscribe: number } }> {
  const byReason = { hard_bounce: 0, complaint: 0, unsubscribe: 0 }
  let total = 0
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('email_suppressions').select('reason').range(from, from + 999)
    if (error || !data || data.length === 0) break
    for (const r of data as { reason: SuppressionReason }[]) {
      total++
      if (r.reason in byReason) byReason[r.reason]++
    }
    if (data.length < 1000) break
  }
  return { total, byReason }
}
