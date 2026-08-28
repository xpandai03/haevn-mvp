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

export interface MemberPromoContext {
  userId: string
  partnershipId: string
  tier: string | null
  plusSource: string | null
  marketSlug: string | null
  marketDisplayName: string | null
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
        // A market that is not live cannot host the promo, whatever the config says.
        if (m?.is_live) {
          marketSlug = m.slug
          marketDisplayName = m.display_name
        }
      }
    }
  } catch {
    // Fail closed: an unreadable market index means no market, means ineligible.
  }

  return {
    userId: user.id,
    partnershipId,
    tier: p.membership_tier,
    plusSource: p.plus_source,
    marketSlug,
    marketDisplayName,
  }
}
