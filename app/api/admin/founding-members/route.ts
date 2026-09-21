/**
 * GET /api/admin/founding-members — the Founding Members view's data.
 *
 * Admin-gated by requireAdminRoute (allowlist); read-only by construction — this
 * handler issues no write of any kind.
 *
 * AGGREGATED SERVER-SIDE ON PURPOSE. The engagement columns are five joins
 * across four tables for ~30 members. Done per row that is ~150 queries; done as
 * six bulk reads and in-memory Maps it is six, and the page renders well inside
 * the 2s budget. The member set is small and bounded (everyone who ever
 * activated), so pagination would add complexity for no benefit.
 *
 * ── COLUMN SOURCES, stated so nothing here looks like a new tracking event ──
 *   name                    partnerships.display_name -> shortName() ("Alex C.")
 *   city / market / CTA     partnerships.city, .promo_market, .promo_cta_source
 *   activated / expires     partnerships.plus_activated_at, .membership_expires_at
 *   last sign-in            auth.users.last_sign_in_at via partnership_members
 *   nudges sent             ready_to_meet_signals.signaller_partnership_id
 *   connections accepted    handshakes where state='matched' OR both consents
 *   messages sent           messages.sender_partnership
 *
 * Nothing new is recorded to produce any of these. "Opened a breakdown" is
 * absent deliberately — see lib/admin/foundingMembers.ts for why.
 */

import { NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { shortName } from '@/lib/admin/matchRows'
import {
  plusSourceGroup, daysToExpiry, signedInSince, summarizeFounding, sortByActivationDesc,
  type FoundingRow,
} from '@/lib/admin/foundingMembers'

export const dynamic = 'force-dynamic'

/** Page through a table so a >1000-row table is never silently truncated. */
async function all(admin: ReturnType<typeof createAdminClient>, table: string, cols: string) {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function GET() {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const now = new Date()

  try {
    // Only members with a plus provenance — never the whole member table.
    const { data: partnerships, error } = await admin
      .from('partnerships')
      .select('id, display_name, city, plus_source, promo_market, promo_cta_source, plus_activated_at, membership_expires_at')
      .in('plus_source', ['founding_member_promo', 'comp', 'paid'])
    if (error) throw new Error(`partnerships: ${error.message}`)

    const ids = new Set((partnerships ?? []).map((p: any) => p.id))

    const [members, rtm, handshakes, messages] = await Promise.all([
      all(admin, 'partnership_members', 'partnership_id, user_id'),
      all(admin, 'ready_to_meet_signals', 'signaller_partnership_id'),
      all(admin, 'handshakes', 'a_partnership, b_partnership, state, a_consent, b_consent'),
      all(admin, 'messages', 'sender_partnership'),
    ])

    // last_sign_in_at per partnership: the most recent across its members, so a
    // couple counts as active when either person came back.
    const usersById = new Map<string, any>()
    for (let page = 1; ; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (!data?.users?.length) break
      for (const u of data.users) usersById.set(u.id, u)
      if (data.users.length < 1000) break
    }
    const lastSignInByPartnership = new Map<string, string | null>()
    for (const m of members as any[]) {
      if (!ids.has(m.partnership_id)) continue
      const u = usersById.get(m.user_id)
      const cur = lastSignInByPartnership.get(m.partnership_id) ?? null
      const next = u?.last_sign_in_at ?? null
      if (next && (!cur || next > cur)) lastSignInByPartnership.set(m.partnership_id, next)
      else if (!lastSignInByPartnership.has(m.partnership_id)) lastSignInByPartnership.set(m.partnership_id, cur)
    }

    const nudgeCount = new Map<string, number>()
    for (const r of rtm as any[]) {
      const id = r.signaller_partnership_id
      if (id) nudgeCount.set(id, (nudgeCount.get(id) ?? 0) + 1)
    }

    // Accepted = the handshake reached 'matched', or both sides consented. Both
    // shapes exist in production, so neither alone is sufficient.
    const acceptedCount = new Map<string, number>()
    for (const h of handshakes as any[]) {
      const accepted = h.state === 'matched' || (h.a_consent === true && h.b_consent === true)
      if (!accepted) continue
      for (const side of [h.a_partnership, h.b_partnership]) {
        if (side) acceptedCount.set(side, (acceptedCount.get(side) ?? 0) + 1)
      }
    }

    const messageCount = new Map<string, number>()
    for (const m of messages as any[]) {
      const id = m.sender_partnership
      if (id) messageCount.set(id, (messageCount.get(id) ?? 0) + 1)
    }

    const rows: FoundingRow[] = (partnerships ?? []).map((p: any) => {
      const lastSignInAt = lastSignInByPartnership.get(p.id) ?? null
      const d = daysToExpiry(p.membership_expires_at, now)
      return {
        partnershipId: p.id,
        name: shortName(p.display_name),
        city: p.city ?? null,
        group: plusSourceGroup(p.plus_source),
        promoMarket: p.promo_market ?? null,
        ctaSource: p.promo_cta_source ?? null,
        activatedAt: p.plus_activated_at ?? null,
        expiresAt: p.membership_expires_at ?? null,
        daysToExpiry: d,
        expired: d !== null && d < 0,
        signedInSinceActivation: signedInSince(lastSignInAt, p.plus_activated_at),
        lastSignInAt,
        nudgesSent: nudgeCount.get(p.id) ?? 0,
        connectionsAccepted: acceptedCount.get(p.id) ?? 0,
        messagesSent: messageCount.get(p.id) ?? 0,
      }
    })

    return NextResponse.json({
      rows: sortByActivationDesc(rows),
      summary: summarizeFounding(rows, now),
      generatedAt: now.toISOString(),
    })
  } catch (e: any) {
    console.error('[admin/founding-members]', e?.message)
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 })
  }
}
