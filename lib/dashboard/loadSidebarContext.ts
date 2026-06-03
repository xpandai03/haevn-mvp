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
  /** Given name for the context bar ("Viewing as {firstName}"). */
  firstName?: string
  /** Partnership city for the context bar ("· {city}"). */
  city?: string
  /** Primary relationship intent for the context bar ("· {intent}"). */
  intent?: string
  /**
   * Paid-tier flag matching loadDashboardData's mapping: any value other
   * than 'free' (e.g. 'pro', 'plus', 'select') is considered a paid tier
   * and renders as "HAEVN+" in the sidebar.
   */
  tier: 'free' | 'plus'
  authenticated: boolean
  isAdmin: boolean
}

/** "Long-term partnership" → "Long-term"; first selected intent otherwise. */
function deriveIntent(raw: unknown): string | undefined {
  let value: string | undefined
  if (Array.isArray(raw)) {
    value = raw.find((x): x is string => typeof x === 'string' && !!x.trim())
  } else if (typeof raw === 'string' && raw.trim()) {
    value = raw.trim()
  }
  if (!value) return undefined
  return value.replace(/\s*partnership\s*$/i, '').trim()
}

function deriveFirstName(fullName?: string): string | undefined {
  if (!fullName?.trim()) return undefined
  const first = fullName.trim().split(/\s+/)[0]
  return first || undefined
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

    // Context-bar extras: partnership city + survey intent. Best-effort —
    // any miss simply omits that segment from the bar.
    let city: string | undefined
    let intent: string | undefined
    if (membership?.partnership_id) {
      const [{ data: partnership }, { data: survey }] = await Promise.all([
        adminClient
          .from('partnerships')
          .select('city')
          .eq('id', membership.partnership_id)
          .maybeSingle(),
        adminClient
          .from('user_survey_responses')
          .select('answers_json')
          .eq('user_id', user.id)
          .order('completion_pct', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      city = partnership?.city?.trim() || undefined
      const answers = survey?.answers_json as
        | Record<string, unknown>
        | undefined
      intent = deriveIntent(answers?.q9_intentions)
    }

    return {
      authenticated: true,
      userName,
      firstName: deriveFirstName(userName),
      city,
      intent,
      tier,
      isAdmin: isAdminUser(user.email),
    }
  } catch (err) {
    // Never let a sidebar loader fault break the page — degrade gracefully.
    console.error('[loadSidebarContext] Failed to load context:', err)
    return { authenticated: false, tier: 'free', isAdmin: false }
  }
}
