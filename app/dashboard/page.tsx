'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { ProfileSummaryCard, ProfileSummaryStats } from '@/components/dashboard/ProfileSummaryCard'
import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { ProfileCard, ProfileCardData } from '@/components/dashboard/ProfileCard'
import { getDashboardStats, getUserMembershipTier, getUserProfilePhoto } from '@/lib/actions/dashboard'
import { getMatches, MatchResult } from '@/lib/actions/matching'
import { getConnections, Connection } from '@/lib/actions/connections'
import { getReceivedNudges, Nudge } from '@/lib/actions/nudges'
import Image from 'next/image'

export default function DashboardPage() {
  const router = useRouter()
  const { user, session, loading: authLoading, signOut } = useAuth()

  // Dashboard data state
  const [stats, setStats] = useState<ProfileSummaryStats>({
    matchesCount: 0,
    newMessagesCount: 0,
    connectionsCount: 0,
    profileViews: 0
  })
  const [membershipTier, setMembershipTier] = useState<'free' | 'plus'>('free')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [nudges, setNudges] = useState<Nudge[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Auth validation
  useEffect(() => {
    if (authLoading) return

    if (!user || !session) {
      console.log('[Dashboard] No authenticated user, redirecting to login')
      router.push('/auth/login')
      return
    }

    console.log('[Dashboard] Loaded for user:', user.id)
  }, [user, session, authLoading, router])

  // Load dashboard data
  useEffect(() => {
    async function loadDashboardData() {
      if (authLoading || !user || !session) return

      try {
        setLoading(true)

        // Fetch all dashboard data in parallel
        const [statsData, tierData, photoUrl, matchesData, connectionsData, nudgesData] = await Promise.all([
          getDashboardStats(),
          getUserMembershipTier(),
          getUserProfilePhoto(),
          getMatches('Bronze'),
          getConnections(),
          getReceivedNudges()
        ])

        setStats(statsData)
        setMembershipTier(tierData)
        setProfilePhotoUrl(photoUrl || undefined)
        setMatches(matchesData)
        setConnections(connectionsData)
        setNudges(nudgesData)

        console.log('[Dashboard] ✅ Data loaded')
      } catch (err: any) {
        console.error('[Dashboard] Error loading data:', err)
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user, session, authLoading])

  // Handle sign out
  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  // Handle profile card click
  const handleProfileClick = (id: string) => {
    router.push(`/profiles/${id}`)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">Error Loading Dashboard</h2>
          <p className="text-haevn-charcoal mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} className="w-full bg-haevn-teal">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-haevn-lightgray">
      {/* Header */}
      <header className="bg-white border-b border-haevn-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Image
            src="/images/haevn-logo-with-icon.png"
            alt="HAEVN"
            width={120}
            height={40}
            className="h-8 sm:h-10 w-auto"
          />

          {/* Sign Out Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-haevn-charcoal hover:text-haevn-teal"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Profile Summary Card */}
        <div className="mb-8">
          <ProfileSummaryCard
            user={user!}
            stats={stats}
            membershipTier={membershipTier}
            profilePhotoUrl={profilePhotoUrl}
          />
        </div>

        {/* Matches Section */}
        <DashboardSection
          title="Matches"
          count={matches.length}
          viewAllHref="/dashboard/matches"
          emptyMessage="No matches yet. Complete your survey to find compatible connections."
          emptyAction={{
            label: "Complete Survey",
            href: "/onboarding/survey"
          }}
        >
          {matches.slice(0, 10).map((match) => (
            <ProfileCard
              key={match.partnership_id}
              profile={{
                id: match.partnership_id,
                photo: undefined, // TODO: Get photo from match data
                username: match.display_name || 'User',
                city: match.city,
                compatibilityPercentage: match.score?.compatibilityPercentage || 0,
                topFactor: match.score?.topFactor || 'Compatible match'
              }}
              variant="match"
              onClick={handleProfileClick}
            />
          ))}
        </DashboardSection>

        {/* Connections Section */}
        <DashboardSection
          title="Connections"
          count={connections.length}
          viewAllHref="/dashboard/connections"
          emptyMessage="No active connections yet. Send a message to start connecting!"
        >
          {connections.slice(0, 10).map((connection) => (
            <ProfileCard
              key={connection.id}
              profile={connection}
              variant="connection"
              onClick={handleProfileClick}
              latestMessage={connection.latestMessage}
              unreadCount={connection.unreadCount}
            />
          ))}
        </DashboardSection>

        {/* Nudges Section */}
        <DashboardSection
          title="Nudges"
          count={nudges.length}
          viewAllHref="/dashboard/nudges"
          emptyMessage={
            membershipTier === 'plus'
              ? "No nudges received yet."
              : "Upgrade to HAEVN+ to send and receive nudges!"
          }
          emptyAction={
            membershipTier === 'free'
              ? {
                  label: "Upgrade to HAEVN+",
                  href: "/pricing"
                }
              : undefined
          }
        >
          {nudges.slice(0, 10).map((nudge) => (
            <ProfileCard
              key={nudge.id}
              profile={{
                id: nudge.senderPartnershipId,
                photo: nudge.photo,
                username: nudge.username,
                city: nudge.city,
                compatibilityPercentage: nudge.compatibilityPercentage,
                topFactor: nudge.topFactor
              }}
              variant="nudge"
              onClick={handleProfileClick}
              nudgedAt={nudge.nudgedAt}
            />
          ))}
        </DashboardSection>

        {/* Personal Navigation Section (Placeholder for Batch 17) */}
        <div className="mt-12 bg-white rounded-3xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-haevn-navy mb-4">Personal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push('/messages')}
            >
              Messages
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push('/settings')}
            >
              Account Details
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push('/onboarding/survey')}
            >
              Survey
            </Button>
          </div>
        </div>

        {/* Resources Section (Placeholder for Batch 17) */}
        <div className="mt-6 bg-white rounded-3xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-haevn-navy mb-4">Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="justify-start" disabled>
              Events (Coming Soon)
            </Button>
            <Button variant="outline" className="justify-start" disabled>
              Glossary (Coming Soon)
            </Button>
            <Button variant="outline" className="justify-start" disabled>
              Learn (Coming Soon)
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
