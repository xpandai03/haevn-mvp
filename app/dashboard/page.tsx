import { redirect } from 'next/navigation'
import { loadDashboardData } from '@/lib/dashboard/loadDashboardData'

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { MatchesSection } from '@/components/dashboard/MatchesSection'
import { ConnectionsSection } from '@/components/dashboard/ConnectionsSection'
import { NudgesSection } from '@/components/dashboard/NudgesSection'
import { PendingRequestsSection } from '@/components/dashboard/PendingRequestsSection'
import { getConnectionCards, getIncomingRequestCards } from '@/lib/actions/handshakes'
import { getUnreadCounts } from '@/lib/actions/connections'
import { getComputedMatchesForPartnership } from '@/lib/actions/computedMatches'

export default async function DashboardPage() {
  // Load all dashboard data server-side
  const data = await loadDashboardData()

  // Redirect to login if not authenticated
  if (!data) {
    redirect('/auth/login')
  }

  const {
    user,
    profile,
    partnership
  } = data

  // Debug log (will remove after verification)
  console.log('[DASHBOARD_STATE]', {
    profileState: partnership?.profileState,
    hasPhoto: !!profile?.photoUrl,
    showCTA: partnership?.profileState !== 'live'
  })

  const isPaidTier = partnership && partnership?.tier !== 'free'

  const { getReceivedNudges } = await import('@/lib/actions/nudges')

  const [nudgesWithData, connectionCards, unreadCounts, computedMatches, incomingRequests] = await Promise.all([
    getReceivedNudges(),
    getConnectionCards(),
    getUnreadCounts(),
    partnership?.id ? getComputedMatchesForPartnership(partnership.id) : Promise.resolve({ matches: [], error: null }),
    getIncomingRequestCards()
  ])
  const matchCount = computedMatches.matches.length
  console.log(`[Dashboard] User ${user.id} has ${matchCount} matches, ${nudgesWithData.length} nudges, ${connectionCards.length} connections, ${unreadCounts.total} unread messages`)

  // Stats with real data
  const stats = {
    matches: matchCount,
    messages: unreadCounts.total,
    connections: connectionCards.length,
    nudges: nudgesWithData.length
  }

  return (
    <div>
      {/* Header + top-level navigation are provided by the shared
          DashboardShell (app/dashboard/layout.tsx). The old <HAEVNHeader />
          and <DashboardNavigation /> components are still exported for
          reference but no longer rendered here. */}
      <div className="max-w-md mx-auto md:max-w-2xl px-4 md:px-8 py-6 space-y-4">
        {/* Profile Banner Card with Photo Modal and CTA */}
        <DashboardClient
          user={user}
          profile={profile}
          membershipTier={partnership?.tier}
          stats={stats}
          showCompleteProfileCTA={partnership?.profileState !== 'live' && !profile?.photoUrl}
          partnershipId={partnership?.id}
        />

        {/* HAEVN Insight — private to user */}
        {partnership?.haevnInsight && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-[#1B9A9A]/10 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B9A9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <h2
                className="text-sm font-semibold text-haevn-navy"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
              >
                Your HAEVN Insight
              </h2>
            </div>
            <p
              className="text-sm text-gray-600 leading-relaxed"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
            >
              {partnership.haevnInsight}
            </p>
          </div>
        )}

        {/* Matches Section */}
        <MatchesSection
          totalMatches={stats.matches}
          currentIndex={1}
          membershipTier={partnership?.tier}
        />

        {/* Pending Connection Requests */}
        {incomingRequests.length > 0 && (
          <PendingRequestsSection requests={incomingRequests} />
        )}

        {/* Connections Section */}

        {/* Nudges Section (for free tier) */}
        {!isPaidTier && <NudgesSection nudges={nudgesWithData} />}

        {/* Connections Section */}
        <ConnectionsSection connections={connectionCards} />
      </div>
    </div>
  )
}
