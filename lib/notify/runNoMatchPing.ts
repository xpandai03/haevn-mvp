/**
 * "No match yet" Match Monday ping — the run.
 *
 * Structured like lib/renotify/runReNotify.ts on purpose: a pure-ish runner with
 * an INJECTABLE sender, so the whole flow (audience, variant, cadence marking,
 * failure handling) is testable without a network call, and so `dryRun` can
 * prove a real production audience end-to-end while sending nothing.
 *
 * THE TWO RULES THIS FILE ENFORCES:
 *
 * 1. no_match_notified_at IS SET ON SUCCESSFUL SEND ONLY. A member whose every
 *    channel failed keeps a NULL marker and is retried on the next eligible run.
 *    Marking on failure would silently drop them for a whole interval — and for
 *    a cohort that is 97% never-signed-in, that is the difference between
 *    eventually reaching someone and never reaching them. Same rule
 *    notify-matches already applies to sms_notified_at.
 *
 * 2. NO RAW MAGIC LINK. Every sign-in URL is a handoff token
 *    (lib/auth/notifySignIn.ts). A dry run mints no token at all.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/services/notifications'
import { issueNotifySignInUrl } from '@/lib/auth/notifySignIn'
import { makeUnsubToken } from '@/lib/suppression/unsubToken'
import { buildNoMatchAudience, pingEveryNWeeks, type PingEntry } from './noMatchAudience'
import type { MarketIndex } from '@/lib/markets/releaseGate'
import type { NoMatchVariant } from './noMatchCopy'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Bounded concurrency for the send loop.
 *
 * The audience build is fully batched (six bulk reads, no per-member queries),
 * so the only per-member work left is one token insert and the provider calls.
 * At ~450 recipients, strictly sequential sends would be ~450 x ~400ms = ~3min
 * and would crowd the 300s ceiling. Eight at a time keeps a full run near ~30s
 * while staying far below any provider rate limit.
 */
export const PING_CONCURRENCY = 8

/**
 * Soft wall-clock budget. The route's maxDuration is 300s; we stop starting new
 * sends at 240s and return a `completed: false` run rather than being hard-killed
 * mid-flight. Members not reached keep a NULL marker, so they are simply first in
 * line next run. Same backstop pattern as recomputeAllMatches.
 */
export const PING_SOFT_BUDGET_MS = 240_000

export interface PingSender {
  send: (opts: {
    phone: string | null
    email: string | null
    partnershipId: string
    signInUrl?: string
    noMatchVariant: NoMatchVariant
    city: string | null
    unsubUrl?: string | null
  }) => Promise<{ sms: { sent: boolean }; email: { sent: boolean } }>
  /** Mint a handoff sign-in URL for this member, or null if one can't be made. */
  signInUrl: (email: string, userId: string) => Promise<string | null>
  /** Stamp no_match_notified_at. Called ONLY after a successful send. */
  markPinged: (partnershipId: string, at: string) => Promise<void>
  /** user id for an email — needed to mint a handoff without creating an account. */
  userIdForEmail: (email: string) => Promise<string | null>
}

export interface PingRunResult {
  enabled: boolean
  dryRun: boolean
  everyNWeeks: number
  eligible: number
  sent: number
  failed: number
  /** Live partnerships that can see a match — excluded by definition. */
  hasMatch: number
  /** Live, matchless, but not yet due under the interval. */
  notDue: number
  /** Due but no usable channel (all emails suppressed and no phone). */
  unreachable: number
  /** Excluded because the MATCH phase notified them in this same run. */
  excludedMatchPhase: number
  byVariant: Record<NoMatchVariant, number>
  /** False when the soft budget stopped the run short. */
  completed: boolean
}

/** Real sender: the existing dispatcher, the existing handoff, one UPDATE. */
export function realPingSender(admin: Admin): PingSender {
  return {
    send: (o) =>
      sendNotification({
        type: 'no_match',
        phone: o.phone,
        email: o.email,
        partnershipId: o.partnershipId,
        signInUrl: o.signInUrl,
        noMatchVariant: o.noMatchVariant,
        city: o.city,
        unsubUrl: o.unsubUrl,
      }),
    signInUrl: (email, userId) => issueNotifySignInUrl(admin, email, userId),
    markPinged: async (partnershipId, at) => {
      const { error } = await admin
        .from('partnerships')
        .update({ no_match_notified_at: at })
        .eq('id', partnershipId)
      if (error) console.error(`[no-match-ping] mark failed for ${partnershipId}:`, error.message)
    },
    userIdForEmail: async (email) => {
      const target = email.trim().toLowerCase()
      for (let page = 1; ; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) return null
        const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
        if (hit) return hit.id
        if (data.users.length < 1000) return null
      }
    },
  }
}

/** Run tasks with bounded concurrency, preserving no order guarantees. */
async function pooled<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      await worker(items[i])
    }
  })
  await Promise.all(runners)
}

export async function runNoMatchPing(params: {
  admin: Admin
  sender: PingSender
  /** Partnerships the MATCH phase notified in this run. Never double-touch. */
  excludePartnershipIds?: Set<string>
  dryRun?: boolean
  now?: Date
  env?: NodeJS.ProcessEnv
  /** Injected market index (tests). Production loads the shared resolver. */
  marketIdx?: MarketIndex
}): Promise<PingRunResult> {
  const { admin, sender, dryRun = false, now = new Date(), env = process.env } = params
  const exclude = params.excludePartnershipIds ?? new Set<string>()
  const startedAt = Date.now()

  const built = await buildNoMatchAudience(admin, {
    excludePartnershipIds: exclude,
    now,
    env,
    marketIdx: params.marketIdx,
  })

  // Per-recipient one-click unsubscribe, same construction as the re-notify
  // footer. Absent secret -> no link and no RFC 8058 headers, never a broken URL.
  const unsubSecret = env.UNSUBSCRIBE_SECRET || ''
  const unsubUrlFor = (email: string): string | null =>
    unsubSecret
      ? `https://www.haevn.app/api/unsubscribe?token=${encodeURIComponent(makeUnsubToken(email, unsubSecret))}`
      : null

  const result: PingRunResult = {
    enabled: true,
    dryRun,
    everyNWeeks: pingEveryNWeeks(env),
    eligible: built.audience.length,
    sent: 0,
    failed: 0,
    hasMatch: built.hasMatch,
    notDue: built.notDue,
    unreachable: built.unreachable.length,
    excludedMatchPhase: exclude.size,
    byVariant: built.byVariant,
    completed: true,
  }

  await pooled(built.audience, PING_CONCURRENCY, async (entry: PingEntry) => {
    if (Date.now() - startedAt > PING_SOFT_BUDGET_MS) {
      result.completed = false
      return
    }

    const email = entry.memberEmails[0] ?? null

    // DRY RUN: everything above ran for real — audience, variant, cadence,
    // suppression. Nothing below happens: no token is minted, no message is
    // sent, no marker is written.
    if (dryRun) {
      result.sent++
      return
    }

    let signInUrl: string | undefined
    if (email) {
      const userId = await sender.userIdForEmail(email)
      if (userId) signInUrl = (await sender.signInUrl(email, userId)) ?? undefined
    }

    const res = await sender.send({
      phone: entry.phone,
      email,
      partnershipId: entry.partnershipId,
      signInUrl,
      noMatchVariant: entry.variant,
      city: entry.city,
      unsubUrl: email ? unsubUrlFor(email) : null,
    })

    if (res.sms.sent || res.email.sent) {
      result.sent++
      // RULE 1: only now.
      await sender.markPinged(entry.partnershipId, now.toISOString())
    } else {
      result.failed++
      // Deliberately NOT marked — retried on the next eligible run.
    }
  })

  return result
}
