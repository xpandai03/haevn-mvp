/**
 * Lightweight server-side loader for the dashboard shell (Sidebar + BottomNav).
 *
 * Keeps the footprint minimal — just enough to render the sidebar footer
 * (user name + tier badge). The full dashboard data loader
 * (`loadDashboardData`) is still used by `/dashboard/page.tsx` for the
 * actual dashboard content.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import { isAdminUser } from '@/lib/admin/allowlist'

export interface SidebarContext {
  userName?: string
  /**
   * Paid-tier flag matching loadDashboardData's mapping: any value other
   * than 'free' (e.g. 'pro', 'plus', 'select') is considered a paid tier
   * and renders as "HAEVN+" in the sidebar.
   */
  tier: 'free' | 'plus'
  authenticated: boolean
  isAdmin: boolean
}

export async function loadSidebarContext(): Promise<SidebarContext> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { authenticated: false, tier: 'free', isAdmin: false }
    }

    const adminClient = await createAdminClient()

    const [{ data: profile }, membership] = await Promise.all([
      adminClient
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single(),
      selectBestPartnership(adminClient, user.id),
    ])

    const userName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      undefined

    // NOTE: `selectBestPartnership` returns `membership_tier`, not `tier`.
    // An earlier version of this file read `membership?.tier`, which was
    // always undefined and always rendered the sidebar as "Member".
    const rawTier = membership?.membership_tier
    const tier: SidebarContext['tier'] =
      rawTier && rawTier !== 'free' ? 'plus' : 'free'

    return {
      authenticated: true,
      userName,
      tier,
      isAdmin: isAdminUser(user.email),
    }
  } catch (err) {
    // Never let a sidebar loader fault break the page — degrade gracefully.
    console.error('[loadSidebarContext] Failed to load context:', err)
    return { authenticated: false, tier: 'free', isAdmin: false }
  }
}
