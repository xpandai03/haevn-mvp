'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import { getConnections, Connection } from '@/lib/actions/connections'
import { useAuth } from '@/lib/auth/context'

export default function ConnectionsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load connections
  useEffect(() => {
    async function loadConnections() {
      if (authLoading || !user) return

      try {
        setLoading(true)
        const connectionsData = await getConnections()
        setConnections(connectionsData)
        console.log('[Connections] Loaded', connectionsData.length, 'connections')
      } catch (err: any) {
        console.error('[Connections] Error:', err)
        setError(err.message || 'Failed to load connections')
      } finally {
        setLoading(false)
      }
    }

    loadConnections()
  }, [user, authLoading])

  const handleProfileClick = (id: string) => {
    router.push(`/profiles/${id}`)
  }

  const handleBack = () => {
    router.push('/dashboard')
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading connections...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">Error Loading Connections</h2>
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
      <header className="bg-white border-b border-haevn-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Back Button and Title */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-haevn-charcoal hover:text-haevn-teal"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold text-haevn-navy"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 700,
                    lineHeight: '110%',
                    letterSpacing: '-0.015em'
                  }}
                >
                  Connections
                </h1>
                <p
                  className="text-sm text-haevn-charcoal/60"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300
                  }}
                >
                  {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
                </p>
              </div>
            </div>

            {/* Filter Button (Future Enhancement) */}
            <Button
              variant="outline"
              size="sm"
              disabled
              className="text-haevn-charcoal"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Filters</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {connections.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
            <div className="max-w-md mx-auto">
              <h2
                className="text-2xl font-bold text-haevn-navy mb-4"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 700
                }}
              >
                No connections yet
              </h2>
              <p
                className="text-haevn-charcoal mb-6"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  lineHeight: '120%'
                }}
              >
                Connections are people you've matched with and started conversations with. Browse your matches and send a message to create a connection.
              </p>
              <Button
                onClick={() => router.push('/dashboard/matches')}
                className="bg-haevn-teal hover:opacity-90 text-white"
              >
                View Matches
              </Button>
            </div>
          </div>
        ) : (
          // Connections List
          <div className="space-y-4">
            {connections.map((connection) => (
              <div key={connection.id} className="w-full">
                <ProfileCard
                  profile={connection}
                  variant="connection"
                  onClick={handleProfileClick}
                  latestMessage={connection.latestMessage}
                  unreadCount={connection.unreadCount}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
