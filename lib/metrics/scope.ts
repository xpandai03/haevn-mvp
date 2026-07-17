/**
 * Scope resolution for metrics — turns a Scope into the set of partnership ids
 * (and, when needed, user ids) that belong to it.
 *
 * REUSES the city→market join that already lives in lib/markets/releaseGate.ts
 * (loadMarketIndex / resolveMarket). Same join, same fail-closed semantics:
 *   partnerships.city -> msa_allowed_zips.city (LOWER) -> msa_name -> market
 * An unresolved city is excluded (fail closed). Casing is handled by
 * normalizeCity inside resolveMarket.
 *
 * The composition RPC mirrors this exact join in SQL; this module is the TS side.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadMarketIndex, resolveMarket } from '@/lib/markets/releaseGate'
import type { Scope } from './types'

export interface ScopeResolution {
  isNetwork: boolean
  marketName: string | null
  /**
   * Partnership ids in scope. `null` means network-wide (no filter — count
   * everything). An empty Set means a market that resolved zero partnerships.
   */
  partnershipIds: Set<string> | null
  /** false when the market index / query failed → caller must fail closed. */
  ok: boolean
}

export async function resolvePartnershipScope(scope: Scope): Promise<ScopeResolution> {
  if (scope === 'network') {
    return { isNetwork: true, marketName: null, partnershipIds: null, ok: true }
  }

  const market = scope.market
  const idx = await loadMarketIndex()
  if (!idx.ok) {
    // Fail closed — empty scope, flagged not-ok.
    return { isNetwork: false, marketName: market, partnershipIds: new Set(), ok: false }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('partnerships').select('id, city').limit(10000)
  if (error) {
    return { isNetwork: false, marketName: market, partnershipIds: new Set(), ok: false }
  }

  const ids = new Set<string>()
  for (const p of (data ?? []) as { id: string; city: string | null }[]) {
    if (resolveMarket(p.city, idx) === market) ids.add(p.id)
  }
  return { isNetwork: false, marketName: market, partnershipIds: ids, ok: true }
}

/**
 * Map a partnership-id scope to the user ids that belong to those partnerships
 * (for the user-keyed tables: nudges, conversations). `null` in → `null` out
 * (network). Chunked to keep .in() URLs under length limits.
 */
export async function userIdsForPartnerships(
  partnershipIds: Set<string> | null
): Promise<Set<string> | null> {
  if (partnershipIds === null) return null
  if (partnershipIds.size === 0) return new Set()

  const admin = createAdminClient()
  const arr = [...partnershipIds]
  const users = new Set<string>()
  const CHUNK = 200
  for (let i = 0; i < arr.length; i += CHUNK) {
    const { data } = await admin
      .from('partnership_members')
      .select('user_id')
      .in('partnership_id', arr.slice(i, i + CHUNK))
    for (const r of (data ?? []) as { user_id: string }[]) users.add(r.user_id)
  }
  return users
}
