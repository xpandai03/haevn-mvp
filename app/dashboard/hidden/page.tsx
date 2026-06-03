'use client'

import { useEffect, useState } from 'react'
import { RotateCcw, Eye } from 'lucide-react'
import {
  getHiddenMatches,
  restoreMatch,
  type HiddenMatchCard,
} from '@/lib/actions/hiddenMatches'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import FullPageLoader from '@/components/ui/full-page-loader'

export default function HiddenMatchesPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [matches, setMatches] = useState<HiddenMatchCard[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (authLoading || !user) return
      try {
        setLoading(true)
        const data = await getHiddenMatches()
        setMatches(data)
      } catch (err) {
        console.error('[Hidden] Error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, authLoading])

  const handleRestore = async (id: string) => {
    const previous = matches
    setRestoring(id)
    setMatches((prev) => prev.filter((m) => m.partnershipId !== id))
    const result = await restoreMatch(id)
    setRestoring(null)
    if (!result.success) {
      setMatches(previous)
      toast({
        title: 'Could not restore match',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Match restored',
        description: 'It will reappear in your matches.',
      })
    }
  }

  if (loading) return <FullPageLoader />

  return (
    <div className="w-full">
      {/* Header */}
      <header className="px-6 sm:px-10 pt-10 pb-6 border-b border-[color:var(--haevn-border)]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
            Matches
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] mt-2 leading-tight">
            Hidden Matches
          </h1>
          <p className="text-sm text-[color:var(--haevn-muted-fg)] mt-2">
            Matches you&rsquo;ve passed on. You can restore them at any time.
          </p>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center border border-[color:var(--haevn-border)] text-[color:var(--haevn-muted-fg)]">
              <Eye size={24} strokeWidth={1.5} />
            </div>
            <p className="text-sm text-[color:var(--haevn-muted-fg)]">
              No hidden matches
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => {
              const heading =
                match.age > 0
                  ? `${match.firstName}, ${match.age}`
                  : match.firstName
              const meta = [
                match.score > 0 ? `${match.score}% match` : null,
                typeof match.distanceMiles === 'number'
                  ? `${match.distanceMiles} miles away`
                  : match.city,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={match.partnershipId}
                  className="dash-card flex items-center justify-between p-5"
                >
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg text-[color:var(--haevn-navy)] truncate">
                      {heading}
                    </h3>
                    {meta && (
                      <p className="mt-1 text-xs text-[color:var(--haevn-muted-fg)]">
                        {meta}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(match.partnershipId)}
                    disabled={restoring === match.partnershipId}
                    className="flex shrink-0 items-center gap-2 border border-[color:var(--haevn-gold)]/30 px-4 py-2 text-xs tracking-wide text-[color:var(--haevn-gold)] transition-colors hover:border-[color:var(--haevn-gold)]/60 disabled:opacity-50"
                  >
                    <RotateCcw size={12} strokeWidth={2} />
                    {restoring === match.partnershipId
                      ? 'Restoring…'
                      : 'Restore'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
