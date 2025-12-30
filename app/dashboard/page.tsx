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
import { SendNudgeButton } from '@/components/dashboard/SendNudgeButton'
import { CompleteProfileCTA } from '@/components/dashboard/CompleteProfileCTA'
import { getConnectionCards } from '@/lib/actions/handshakes'

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

  const nudgesWithData = await getReceivedNudges()
  const connectionCards = await getConnectionCards()
  console.log(`[Dashboard] User ${user.id} has ${nudgesWithData.length} nudges, ${connectionCards.length} connections`)

  // Mock stats for now - will come from real data later
  const stats = {
    matches: 12,
    messages: 4,
    connections: connectionCards.length,
    nudges: nudgesWithData.length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <HAEVNHeader />

      {/* Main Content - Compact mobile-first layout */}
      <main className="max-w-md mx-auto px-4 py-3 space-y-4">
        {/* Profile Banner Card with Photo Modal */}
        <DashboardClient
          user={user}
          profile={profile}
          membershipTier={partnership?.tier}
          stats={stats}
        />

        {/* Complete Profile CTA - shown when profile is not live */}
        {partnership?.profileState !== 'live' && <CompleteProfileCTA />}

        {/* Matches Section */}
        <MatchesSection
          totalMatches={stats.matches}
          currentIndex={1}
        />


        {/* Connections Section */}

        {/* Nudges Section (for free tier) */}
        {!isPaidTier && <NudgesSection nudges={nudgesWithData} />}

        {/* Connections Section */}
        <ConnectionsSection connections={connectionCards} />
        {/* Send Nudge Test Button */}
        <SendNudgeButton />

        {/* Personal & Resources Navigation */}
        <DashboardNavigation membershipTier={partnership?.tier} />
      </main>
    </div>
  )
}
