/**
 * Server-side: resolve everything eligibility needs for the current viewer.
 *
 * Reuses lib/markets/releaseGate for the city -> market_name half of the join —
 * the same resolver release gating and the metrics scope already use. This module
 * only adds the market_name -> (slug, display_name) lookup that 055 introduced.
 * There is no second city-matching implementation, and no city literal anywhere.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadMarketIndex, resolveMarket } from '@/lib/markets/releaseGate'
import { getPromoConfig, isAllMarkets } from './config'

export interface MemberPromoContext {
  userId: string
  partnershipId: string
  tier: string | null
  plusSource: string | null
  marketSlug: string | null
  marketDisplayName: string | null
  /**
   * partnerships.city verbatim. Always populated when the member has one, market
   * or no market — it is what the copy and the attribution fall back to once the
   * promo opens beyond the single live market.
   */
  cityName: string | null
}

/**
 * Null when there is no signed-in user or no partnership — callers treat that as
 * ineligible and render the existing page.
 */
export async function loadMemberPromoContext(): Promise<MemberPromoContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('partnership_members')
    .select('partnership_id')
    .eq('user_id', user.id)
    .order('role', { ascending: false }) // prefer owner, same as getUserMembershipTier
    .limit(1)
    .maybeSingle()

  const partnershipId = (membership as { partnership_id?: string } | null)?.partnership_id
  if (!partnershipId) return null

  const { data: partnership } = await admin
    .from('partnerships')
    .select('id, city, membership_tier, plus_source')
    .eq('id', partnershipId)
    .maybeSingle()
  if (!partnership) return null

  const p = partnership as { city: string | null; membership_tier: string | null; plus_source: string | null }

  // city -> market_name (shared resolver) -> slug/display_name (055 columns).
  let marketSlug: string | null = null
  let marketDisplayName: string | null = null
  // Under the `all` sentinel, is_live no longer decides whether a market may host
  // the promo — the promo is deliberately open everywhere, so a member in a
  // pre-launch market keeps their real slug and display name instead of being
  // flattened to "no market". Without the sentinel this is unchanged: is_live is
  // still required, so flags-off behaviour is byte-for-byte what it was.
  const requireLiveMarket = !isAllMarkets(getPromoConfig())
  try {
    const idx = await loadMarketIndex()
    if (idx.ok) {
      const marketName = resolveMarket(p.city, idx)
      if (marketName) {
        const { data: market } = await admin
          .from('markets')
          .select('slug, display_name, is_live')
          .eq('market_name', marketName)
          .maybeSingle()
        const m = market as { slug: string | null; display_name: string | null; is_live: boolean } | null
        if (m && (m.is_live || !requireLiveMarket)) {
          marketSlug = m.slug
          marketDisplayName = m.display_name
        }
      }
    }
  } catch {
    // Fail closed on the MARKET half only: an unreadable index means no market.
    // cityName below is read straight off the partnership and is unaffected —
    // which is what keeps a member reachable when the index is down and the
    // sentinel is on.
  }

  return {
    userId: user.id,
    partnershipId,
    tier: p.membership_tier,
    plusSource: p.plus_source,
    marketSlug,
    marketDisplayName,
    cityName: p.city?.trim() || null,
  }
}
