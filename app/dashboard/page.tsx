'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Heart, LogOut, Loader2, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getMatches, MatchResult } from '@/lib/actions/matching'
import { getIncomingHandshakeCount, getConnections } from '@/lib/actions/handshakes'
import { getUnreadNudgesCount } from '@/lib/actions/nudges'
import { MatchCardSimple } from '@/components/MatchCardSimple'
import { MatchModal } from '@/components/MatchModal'
import { HandshakeNotifications } from '@/components/HandshakeNotifications'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const router = useRouter()
  const { user: authUser, signOut } = useAuth()
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionsCount, setConnectionsCount] = useState(0)
  const [nudgesCount, setNudgesCount] = useState(0)
  const supabase = createClient()

  // Validate session on mount to prevent stale sessions
  useEffect(() => {
    const validateSession = async () => {
      console.log('[Dashboard] Validating session...')
      const { data: { session }, error } = await supabase.auth.getSession()

      if (!session || error) {
        console.error('[Dashboard] Invalid or expired session:', error)
        console.log('[Dashboard] Redirecting to login...')
        router.push('/auth/login')
        return
      }

      console.log('[Dashboard] Session valid until:', session.expires_at)
    }

    validateSession()
  }, [supabase, router])

  useEffect(() => {
    async function loadMatches() {
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      try {
        setLoading(true)
        const [matchData, connections, nudgesData] = await Promise.all([
          getMatches('Bronze'),
          getConnections(),
          getUnreadNudgesCount()
        ])
        setMatches(matchData)
        setConnectionsCount(connections.length)
        setNudgesCount(nudgesData.count)
      } catch (err: any) {
        console.error('Error loading matches:', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [authUser, router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleMatchClick = (match: MatchResult) => {
    setSelectedMatch(match)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-muted-foreground">Finding your matches...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Matches</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-haevn-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 pt-4 sm:pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-6">
              {/* HAEVN Logo */}
              <img
                src="/images/haevn-logo-transparent.png"
                alt="HAEVN"
                className="h-14 sm:h-20 w-auto"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HandshakeNotifications />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/partner-profile')}
                className="text-haevn-gray-700 hover:text-haevn-teal-600 text-xs sm:text-sm"
              >
                <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Profile & Settings</span>
                <span className="sm:hidden">Profile</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-xs sm:text-sm">
                <LogOut className="h-4 w-4 mr-1 sm:mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Matches Card */}
          <Card className="bg-white border-2 border-haevn-gray-300 rounded-2xl hover:shadow-lg transition-all cursor-pointer" onClick={() => router.push('/matches')}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-haevn-teal-50 rounded-full">
                  <Sparkles className="h-6 w-6 text-haevn-teal-600" />
                </div>
                <CardTitle className="text-h3 text-haevn-gray-900">Matches</CardTitle>
              </div>
              <div className="text-display-lg text-haevn-teal-600">{matches.length}</div>
              <p className="text-body-sm text-haevn-gray-600 mt-2">
                Compatibility-based connections
              </p>
            </CardContent>
          </Card>

          {/* Connections Card */}
          <Card className="bg-white border-2 border-haevn-gray-300 rounded-2xl hover:shadow-lg transition-all cursor-pointer" onClick={() => router.push('/connections')}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-haevn-orange-50 rounded-full">
                  <Heart className="h-6 w-6 text-haevn-orange-600" />
                </div>
                <CardTitle className="text-h3 text-haevn-gray-900">Connections</CardTitle>
              </div>
              <div className="text-display-lg text-haevn-orange-600">{connectionsCount}</div>
              <p className="text-body-sm text-haevn-gray-600 mt-2">
                Active conversations
              </p>
            </CardContent>
          </Card>

          {/* Nudges Card */}
          <Card className="bg-white border-2 border-haevn-gray-300 rounded-2xl hover:shadow-lg transition-all cursor-pointer" onClick={() => router.push('/nudges')}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-haevn-gray-200 rounded-full">
                  <Sparkles className="h-6 w-6 text-haevn-gray-700" />
                </div>
                <CardTitle className="text-h3 text-haevn-gray-900">Nudges</CardTitle>
              </div>
              <div className="text-display-lg text-haevn-gray-700">{nudgesCount}</div>
              <p className="text-body-sm text-haevn-gray-600 mt-2">
                New notifications
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tier Summary */}
        {matches.length > 0 && (
          <Card className="mb-8 bg-white border-2 border-haevn-gray-300 rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-haevn-teal-50 rounded-full">
                  <Sparkles className="h-6 w-6 text-haevn-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-h3 text-haevn-gray-900">Compatibility Breakdown</CardTitle>
                  <CardDescription className="text-body-sm text-haevn-gray-600">
                    Your matches by tier
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {['Platinum', 'Gold', 'Silver', 'Bronze'].map(tier => {
                  const count = matches.filter(m => m.tier === tier).length
                  const colors = {
                    Platinum: 'bg-haevn-teal-50 text-haevn-teal-800 border-haevn-teal-200',
                    Gold: 'bg-haevn-orange-50 text-haevn-orange-800 border-haevn-orange-200',
                    Silver: 'bg-haevn-gray-200 text-haevn-gray-700 border-haevn-gray-400',
                    Bronze: 'bg-haevn-orange-100 text-haevn-orange-900 border-haevn-orange-300',
                  }[tier]

                  return (
                    <div key={tier} className={`text-center p-3 sm:p-4 rounded-2xl border-2 ${colors}`}>
                      <p className="text-display-sm">{count}</p>
                      <p className="text-caption font-medium">{tier}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {matches.length === 0 && (
          <Card className="text-center py-12 border-2 border-haevn-gray-300 rounded-2xl">
            <CardContent>
              <Heart className="h-16 w-16 mx-auto text-haevn-gray-400 mb-4" />
              <h2 className="text-h2 text-haevn-gray-900 mb-2">No Matches Yet</h2>
              <p className="text-body text-haevn-gray-600 max-w-md mx-auto">
                We're working on finding compatible matches for you. Check back soon, or complete your profile to improve your matches.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Matches Grid */}
        {matches.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {matches.map((match) => (
              <MatchCardSimple
                key={match.partnership.id}
                match={match}
                onClick={() => handleMatchClick(match)}
              />
            ))}
          </div>
        )}

        {/* Match Modal */}
        <MatchModal
          match={selectedMatch}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      </div>
    </div>
  )
}
