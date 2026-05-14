'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileCard } from '@/components/dashboard/ProfileCard'
import { getConnections, Connection } from '@/lib/actions/connections'
import { useAuth } from '@/lib/auth/context'
import FullPageLoader from '@/components/ui/full-page-loader'

export default function ConnectionsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadConnections() {
      if (authLoading || !user) return

      try {
        setLoading(true)
        const connectionsData = await getConnections()
        setConnections(connectionsData)
      } catch (err: unknown) {
        console.error('[Connections] Error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load connections')
      } finally {
        setLoading(false)
      }
    }

    void loadConnections()
  }, [user, authLoading])

  const handleProfileClick = (id: string) => {
    router.push(`/profiles/${id}`)
  }

  const handleBack = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return <FullPageLoader />
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 py-16">
        <div className="dash-card w-full max-w-md p-8 text-center">
          <h2 className="font-heading text-xl text-[color:var(--haevn-navy)]">
            Couldn&apos;t load connections
          </h2>
          <p className="mt-2 text-sm text-[color:var(--haevn-muted-fg)]">{error}</p>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="haevn-btn-teal mt-6 w-full"
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <header className="border-b border-[color:var(--haevn-border)] px-6 pb-6 pt-10 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="mt-1 text-[color:var(--haevn-charcoal)] transition-colors hover:text-[color:var(--haevn-teal)]"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--haevn-teal)]">
                Dashboard
              </p>
              <h1 className="font-heading mt-2 text-3xl leading-tight text-[color:var(--haevn-navy)] sm:text-4xl">
                Connections
              </h1>
              <p className="mt-2 text-sm text-[color:var(--haevn-muted-fg)]">
                {connections.length}{' '}
                {connections.length === 1 ? 'connection' : 'connections'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="mt-2 shrink-0 border-[color:var(--haevn-border)] text-[color:var(--haevn-charcoal)]"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 sm:px-10 sm:py-12">
        {connections.length === 0 ? (
          <div className="dash-card p-10 text-center">
            <h2 className="font-heading text-xl text-[color:var(--haevn-navy)]">
              No connections yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[color:var(--haevn-muted-fg)]">
              Connections are people you&apos;ve matched with and started
              conversations with. Browse your matches to send a connection
              request.
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard/matches')}
              className="haevn-btn-primary mt-6"
            >
              View matches
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((connection) => (
              <ProfileCard
                key={connection.id}
                profile={connection}
                variant="connection"
                onClick={handleProfileClick}
                latestMessage={connection.latestMessage}
                unreadCount={connection.unreadCount}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
