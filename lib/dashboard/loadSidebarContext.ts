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
  tier: 'free' | 'plus' | 'select'
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

    const rawTier = membership?.tier as string | undefined
    const tier: SidebarContext['tier'] =
      rawTier === 'plus' || rawTier === 'select' ? rawTier : 'free'

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
