import { redirect } from 'next/navigation'
import { loadDashboardData } from '@/lib/dashboard/loadDashboardData'

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { MatchesSection } from '@/components/dashboard/MatchesSection'
import { ConnectionsSection } from '@/components/dashboard/ConnectionsSection'
import { DashboardNavigation } from '@/components/dashboard/DashboardNavigation'
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <HAEVNHeader />

      {/* Main Content - Compact mobile-first layout */}
      <main className="max-w-md mx-auto px-4 py-3 space-y-4">
        {/* Profile Banner Card with Photo Modal and CTA */}
        <DashboardClient
          user={user}
          profile={profile}
          membershipTier={partnership?.tier}
          stats={stats}
          showCompleteProfileCTA={partnership?.profileState !== 'live' && !profile?.photoUrl}
          partnershipId={partnership?.id}
        />

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

        {/* Personal & Resources Navigation */}
        <DashboardNavigation membershipTier={partnership?.tier} />
      </main>
    </div>
  )
}
