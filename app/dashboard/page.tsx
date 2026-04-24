import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * /dashboard is now a gate: authenticated users go straight to their
 * matches (the primary post-login experience). The previous content
 * (profile banner + MatchesSection + NudgesSection + ConnectionsSection)
 * lived here but has been split across /dashboard/matches,
 * /dashboard/connections, /dashboard/nudges, and the new Profile page.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  redirect('/dashboard/matches')
}
