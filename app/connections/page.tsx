'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getMyConnections, type ConnectionResult } from '@/lib/actions/connections'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Users } from 'lucide-react'
import { HaevnLogo } from '@/components/HaevnLogo'
import { ConnectionCard } from '@/components/connections/ConnectionCard'

export default function ConnectionsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [connections, setConnections] = useState<ConnectionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function loadConnections() {
      if (!user) return

      try {
        setLoading(true)
        const connectionsData = await getMyConnections()
        setConnections(connectionsData)
      } catch (err: any) {
        console.error('Error loading connections:', err)
        setError(err.message || 'Failed to load connections')
      } finally {
        setLoading(false)
      }
    }

    loadConnections()
  }, [user])

  const handleViewConnection = (connection: ConnectionResult) => {
    // Navigate to unified profile view with handshakeId for messaging
    router.push(`/profiles/${connection.partnership.id}?handshakeId=${connection.handshakeId}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
          <p className="text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Loading your connections...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border-2 border-[#252627]/10">
          <h2 className="text-h2 text-red-600 mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Error Loading Connections
          </h2>
          <p className="text-body text-[#252627]/70 mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            {error}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-[#E29E0C] to-[#D88A0A]"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-[#252627] hover:text-[#008080]"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </Button>
            <HaevnLogo size="sm" />
          </div>

          <div>
            <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              Your Connections
            </h1>
            <p className="text-body text-[#252627]/70" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              {connections.length} {connections.length === 1 ? 'partnership' : 'partnerships'} you've connected with
            </p>
          </div>
        </div>

        {/* Connections Grid */}
        {connections.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-[#252627]/20">
              <Users className="h-16 w-16 mx-auto text-[#252627]/20 mb-4" />
              <h3 className="text-h3 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                No connections yet
              </h3>
              <p className="text-body text-[#252627]/60 mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                Browse matches to find compatible people.
              </p>
              <Button
                onClick={() => router.push('/matches')}
                className="bg-gradient-to-r from-[#E29E0C] to-[#D88A0A] hover:from-[#D88A0A] hover:to-[#C77A09] text-white"
                style={{ fontFamily: 'Roboto', fontWeight: 500 }}
              >
                Browse Matches
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.handshakeId}
                connection={connection}
                onClick={() => handleViewConnection(connection)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
