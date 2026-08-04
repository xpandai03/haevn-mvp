/**
 * Re-notify audience — the eligibility predicate and the batched reads that build it.
 *
 * Eligible partnership (member unit) =
 *   released      : a computed_matches row with release_at <= now
 *                   (the notify pipeline's own definition, notify-matches:67)
 *   AND notified-once : sms_notified_at set on a released row, on a PRIOR day
 *                   (the durable "already notified" marker — survives the weekly
 *                    recompute; partitions cleanly from the existing flow, which
 *                    owns sms_notified_at IS NULL / never-notified → no double-cover).
 *                   The prior-DAY floor is load-bearing: the 14:00 notify sets
 *                   sms_notified_at, so without it the 16:00 re-notify would re-hit
 *                   everyone notified that same Monday (the same-day double-tap).
 *   AND never-logged-in : every member's auth.users.last_sign_in_at IS NULL
 *   AND live-market : partnership.city resolves to a live market (reuses releaseGate)
 * Suppression (login re-check at send time, cap) is applied later in runReNotify.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadMarketIndex, isCityLive } from '@/lib/markets/releaseGate'
import { getRenotifySuppressedEmails } from '@/lib/suppression/emailSuppressions'
import type { RenotifyVariant } from './copy'

type Admin = ReturnType<typeof createAdminClient>

export interface AudienceEntry {
  partnershipId: string
  variant: RenotifyVariant
  phone: string | null
  memberEmails: string[]
}

// ── pure predicate helpers (unit-tested) ─────────────────────────────────────

/** A phone is usable if it's a non-trivial string (≥7 chars after trim). */
export function resolveVariant(phone: string | null | undefined): RenotifyVariant {
  return phone && String(phone).trim().length >= 7 ? 'has_phone' : 'no_phone'
}

/** True iff the partnership has members and NONE of them has ever logged in. */
export function isNeverLoggedIn(memberUserIds: string[], loggedIn: Set<string>): boolean {
  if (memberUserIds.length === 0) return false // no members → can't notify anyone
  return memberUserIds.every((u) => !loggedIn.has(u))
}

/**
 * True iff this single sms_notified_at timestamp is on a PRIOR day (strictly
 * before the run day's UTC midnight). Row-level building block for
 * isNotifiedOnceForRenotify below.
 */
export function isNotifiedOncePrior(
  smsNotifiedAt: string | null | undefined,
  dayStartIso: string
): boolean {
  return !!smsNotifiedAt && smsNotifiedAt < dayStartIso
}

/**
 * "Notified-once" for re-notify, at the PARTNERSHIP level.
 *
 * A partnership qualifies iff it was notified on a prior day AND was NOT notified
 * at all today. The `AND NOT same-day` clause is load-bearing: a partnership
 * notified in a prior week that ALSO gets a NEW match notified today (14:00) has
 * BOTH a prior-day row and a same-day row — the first fix (row-level prior check
 * only) let the prior-day row keep it re-notify-eligible while the 14:00 notify
 * already messaged it, producing the same-Monday double-tap (Aug 3: 8 of 65).
 * Excluding any partnership notified today, regardless of prior history, closes
 * that gap. A same-day notify is redundant to re-notify anyway; the partnership
 * is caught next Monday.
 */
export function isNotifiedOnceForRenotify(
  hasPriorDayNotify: boolean,
  hasSameDayNotify: boolean
): boolean {
  return hasPriorDayNotify && !hasSameDayNotify
}

/** The full partnership-level predicate (release/notify/login/market already resolved). */
export function isEligible(p: {
  released: boolean
  notifiedOnce: boolean
  liveMarket: boolean
  neverLoggedIn: boolean
}): boolean {
  return p.released && p.notifiedOnce && p.liveMarket && p.neverLoggedIn
}

// ── login snapshot ───────────────────────────────────────────────────────────

/**
 * The set of user ids that have EVER logged in (auth.users.last_sign_in_at set).
 * Snapshot taken at job start = send time for the single Monday run, so a
 * Sunday-night login is already reflected.
 */
export async function getLoggedInUserIds(admin: Admin): Promise<Set<string>> {
  const ids = new Set<string>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    for (const u of data.users) if (u.last_sign_in_at) ids.add(u.id)
    if (data.users.length < 1000) break
  }
  return ids
}

// ── audience build ───────────────────────────────────────────────────────────

async function fetchAll(admin: Admin, table: string, cols: string): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export interface BuildAudienceResult {
  audience: AudienceEntry[]
  /** Partnership ids dropped because EVERY member email is suppressed (logged
   *  as suppressed_reason='email_suppressed'). */
  emailSuppressed: string[]
}

export async function buildAudience(
  admin: Admin,
  loggedIn: Set<string>,
  now: Date = new Date()
): Promise<BuildAudienceResult> {
  const nowIso = now.toISOString()
  // UTC midnight of the run day — the floor that keeps today's notifies out of
  // today's re-notify audience (the same-Monday double-tap fix).
  const dayStart = new Date(now)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayStartIso = dayStart.toISOString()

  const [cm, members, profiles, partnerships, marketIdx, suppressedEmails] = await Promise.all([
    fetchAll(admin, 'computed_matches', 'partnership_a, release_at, sms_notified_at'),
    fetchAll(admin, 'partnership_members', 'partnership_id, user_id'),
    fetchAll(admin, 'profiles', 'user_id, email'),
    fetchAll(admin, 'partnerships', 'id, city, phone'),
    loadMarketIndex(true),
    getRenotifySuppressedEmails(admin),
  ])

  // released; and per partnership, whether it has a prior-day and/or same-day
  // notified row. notified-once = prior-day AND NOT same-day (see helper).
  const released = new Set<string>()
  const priorDayNotify = new Set<string>()
  const sameDayNotify = new Set<string>()
  for (const r of cm as { partnership_a: string; release_at: string | null; sms_notified_at: string | null }[]) {
    if (r.release_at && r.release_at <= nowIso) {
      released.add(r.partnership_a)
      if (r.sms_notified_at) {
        if (r.sms_notified_at < dayStartIso) priorDayNotify.add(r.partnership_a)
        else sameDayNotify.add(r.partnership_a)
      }
    }
  }
  const notifiedOnce = new Set<string>()
  for (const p of priorDayNotify) {
    if (isNotifiedOnceForRenotify(true, sameDayNotify.has(p))) notifiedOnce.add(p)
  }

  const membersByP = new Map<string, string[]>()
  for (const m of members as { partnership_id: string; user_id: string }[]) {
    const a = membersByP.get(m.partnership_id) ?? []
    a.push(m.user_id)
    membersByP.set(m.partnership_id, a)
  }
  const emailByUser = new Map<string, string | null>(
    (profiles as { user_id: string; email: string | null }[]).map((p) => [p.user_id, p.email])
  )

  const audience: AudienceEntry[] = []
  const emailSuppressed: string[] = []
  for (const p of partnerships as { id: string; city: string | null; phone: string | null }[]) {
    const memberIds = membersByP.get(p.id) ?? []
    const eligible = isEligible({
      released: released.has(p.id),
      notifiedOnce: notifiedOnce.has(p.id),
      liveMarket: isCityLive(p.city, marketIdx),
      neverLoggedIn: isNeverLoggedIn(memberIds, loggedIn),
    })
    if (!eligible) continue

    const allEmails = memberIds
      .map((u) => emailByUser.get(u))
      .filter((e): e is string => !!e && e.includes('@'))
    // Drop suppressed addresses. If a partnership HAD emails but every one is
    // suppressed, record it as email_suppressed (visible in the readout).
    const memberEmails = allEmails.filter((e) => !suppressedEmails.has(e.toLowerCase()))
    if (allEmails.length > 0 && memberEmails.length === 0) {
      emailSuppressed.push(p.id)
      continue
    }

    audience.push({
      partnershipId: p.id,
      variant: resolveVariant(p.phone),
      phone: p.phone ?? null,
      memberEmails,
    })
  }
  return { audience, emailSuppressed }
}
