import { redirect } from 'next/navigation'
import { loadDashboardData } from '@/lib/dashboard/loadDashboardData'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { MatchesSection } from '@/components/dashboard/MatchesSection'
import { ConnectionsSection } from '@/components/dashboard/ConnectionsSection'
import { DashboardNavigation } from '@/components/dashboard/DashboardNavigation'

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

  // Mock stats for now - will come from real data later
  const stats = {
    matches: 12,
    messages: 4,
    connections: 8
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

        {/* Matches Section */}
        <MatchesSection
          totalMatches={stats.matches}
          currentIndex={1}
        />

        {/* Connections Section */}
        <ConnectionsSection
          totalConnections={stats.connections}
          currentIndex={1}
        />

        {/* Personal & Resources Navigation */}
        <DashboardNavigation />
      </main>
    </div>
  )
}
