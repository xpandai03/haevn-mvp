'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Check,
  X,
  Lock,
  MessageCircle,
  Eye,
  FileText,
  BarChart3,
  Zap,
} from 'lucide-react'
import {
  getComputedMatchCards,
  type ComputedMatchCard,
} from '@/lib/actions/computedMatchCards'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { hideMatch } from '@/lib/actions/hiddenMatches'
import { sendHandshakeRequest } from '@/lib/actions/handshakes'
import {
  getHandshakeIdForPartnerships,
  getMyPartnershipId,
} from '@/lib/actions/connections'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import FullPageLoader from '@/components/ui/full-page-loader'

const DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: 'goals_expectations', label: 'Goals & Expectations' },
  { key: 'structure_fit', label: 'Structure Fit' },
  { key: 'boundaries_comfort', label: 'Boundaries & Comfort' },
  { key: 'openness_curiosity', label: 'Openness & Curiosity' },
  { key: 'sexual_energy', label: 'Sexual Energy' },
]

function strengthLabel(score: number): string {
  if (score >= 85) return 'Strong Alignment'
  if (score >= 70) return 'Good Alignment'
  if (score >= 50) return 'Compatible'
  return 'Room to Grow'
}

function summaryFor(label: string, score: number): string {
  if (score >= 85)
    return `You're strongly aligned on ${label.toLowerCase()}.`
  if (score >= 70)
    return `Good alignment on ${label.toLowerCase()}, with room to explore.`
  if (score >= 50)
    return `Compatible on ${label.toLowerCase()} — worth a conversation.`
  return `An area where you differ — ${label.toLowerCase()} may need attention.`
}

function redactName(name: string): string {
  const first = name.trim().charAt(0)
  return first ? `${first.toUpperCase()}***` : '—'
}

export default function MatchDetailPage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [match, setMatch] = useState<ComputedMatchCard | null>(null)
  const [tier, setTier] = useState<'free' | 'plus'>('free')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [handshakeId, setHandshakeId] = useState<string | null>(null)
  const [nudging, setNudging] = useState(false)
  const [requested, setRequested] = useState(false)

  const isFree = tier === 'free'

  useEffect(() => {
    async function load() {
      if (authLoading || !user) return
      try {
        setLoading(true)
        const [cards, tierData] = await Promise.all([
          getComputedMatchCards('Bronze'),
          getUserMembershipTier(),
        ])
        setTier(tierData)
        const found = cards.find((c) => c.partnership.id === matchId) || null
        if (!found) {
          setNotFound(true)
          return
        }
        setMatch(found)

        // Resolve connection status (HAEVN+ only — drives Message vs Connect)
        if (tierData === 'plus') {
          try {
            const myId = await getMyPartnershipId()
            if (myId) {
              const hs = await getHandshakeIdForPartnerships(myId, matchId)
              setHandshakeId(hs)
            }
          } catch {
            /* non-fatal */
          }
        }
      } catch (err) {
        console.error('[MatchDetail] Error:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, authLoading, matchId])

  const dims = useMemo(() => {
    if (!match) return []
    return DIMENSIONS.map((d) => ({
      ...d,
      score: match.breakdown[d.key]?.score ?? 0,
    })).filter((d) => match.breakdown[d.key] != null)
  }, [match])

  const toggleDim = (key: string) => {
    if (isFree) return
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handlePass = async () => {
    await hideMatch(matchId)
    router.push('/dashboard/matches')
  }

  const handleConnect = async () => {
    setNudging(true)
    const result = await sendHandshakeRequest(matchId)
    setNudging(false)
    if (result.success) {
      setRequested(true)
      toast({
        title: 'Connection request sent',
        description: `We let ${match?.partnership.first_name ?? 'them'} know you'd like to connect.`,
      })
    } else {
      toast({
        title: 'Could not send request',
        description: result.error || 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleMessage = () => {
    if (handshakeId) router.push(`/chat/${handshakeId}`)
  }

  if (loading || authLoading) return <FullPageLoader />

  if (notFound || !match) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="font-heading text-2xl text-[color:var(--haevn-navy)]">
          Match not found
        </h1>
        <p className="mt-2 text-sm text-[color:var(--haevn-muted-fg)]">
          This match may have expired or been hidden.
        </p>
        <button
          onClick={() => router.push('/dashboard/matches')}
          className="haevn-btn-teal mt-6 text-sm"
        >
          Back to matches
        </button>
      </div>
    )
  }

  const p = match.partnership
  const name = isFree ? redactName(p.first_name) : p.first_name
  const heading = p.age > 0 ? `${name}, ${p.age}` : name
  const demographics = [
    p.gender,
    p.sexuality,
    p.relationship_structure,
    typeof p.distance_miles === 'number'
      ? `${p.distance_miles} miles away`
      : p.city,
  ]
    .filter(Boolean)
    .join(' · ')
  const aiIntro =
    p.connection_summary ||
    p.short_bio ||
    'A strong overall match based on your survey alignment across five key areas.'

  return (
    <div className="min-h-screen bg-[color:var(--haevn-dash-bg)]">
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/matches')}
        aria-label="Back to matches"
        className="fixed left-4 top-14 z-30 flex h-10 w-10 items-center justify-center border border-[color:var(--haevn-border)] bg-white/90 text-[color:var(--haevn-muted-fg)] backdrop-blur-xl transition-colors hover:text-[color:var(--haevn-navy)] md:left-[calc(16rem+1.5rem)] md:top-16"
      >
        <ArrowLeft size={18} strokeWidth={1.5} />
      </button>

      {/* Hero */}
      {!isFree && p.photo_url ? (
        <div className="relative aspect-[3/2] w-full overflow-hidden md:aspect-[16/7]">
          <img
            src={p.photo_url}
            alt={p.first_name}
            className="h-full w-full object-cover object-[center_25%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--haevn-dash-bg)] via-transparent to-transparent" />
        </div>
      ) : (
        <div className="relative flex aspect-[3/2] w-full items-center justify-center bg-gradient-to-b from-haevn-warm-gray to-[#D5D3D0] md:aspect-[16/7]">
          <svg viewBox="0 0 200 200" className="h-36 w-36 opacity-20" aria-hidden>
            <circle cx="100" cy="70" r="40" fill="#9CA3AF" />
            <ellipse cx="100" cy="170" rx="60" ry="50" fill="#9CA3AF" />
          </svg>
          <span className="absolute flex items-center gap-1.5 bg-white/75 px-5 py-2.5 text-sm uppercase tracking-wider text-[color:var(--haevn-muted-fg)] backdrop-blur-sm">
            <Lock size={13} strokeWidth={1.5} /> Upgrade to view
          </span>
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[color:var(--haevn-dash-bg)] via-[color:var(--haevn-dash-bg)]/60 to-transparent" />
        </div>
      )}

      {/* Content card */}
      <div className="relative z-10 mx-auto -mt-8 max-w-2xl px-4 md:px-8">
        <div className="dash-card px-6 pb-8 pt-7 md:px-8 md:pb-10">
          {/* Identity */}
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-[color:var(--haevn-navy)] md:text-3xl">
              {heading}
            </h1>
            {!isFree && demographics && (
              <p className="mt-1.5 text-sm tracking-wide text-[color:var(--haevn-navy)]">
                {demographics}
              </p>
            )}
          </div>

          {/* Compatibility */}
          <div className="mb-8">
            <span className="font-heading text-4xl font-semibold text-[color:var(--haevn-gold)] tabular-nums md:text-5xl">
              {match.score}%
            </span>
            <span className="ml-2 text-base text-[color:var(--haevn-muted-fg)]">
              Match
            </span>
            <p className="mt-2 text-sm text-[color:var(--haevn-charcoal)]">
              This match is based on your alignment across five key areas
            </p>
          </div>

          {/* AI intro */}
          <div className="relative mb-10">
            <p
              className={`text-base leading-relaxed text-[color:var(--haevn-navy)] ${
                isFree ? 'line-clamp-2' : ''
              }`}
            >
              {aiIntro}
            </p>
            {isFree && (
              <p className="mt-2 text-sm text-[color:var(--haevn-teal)]">
                Unlock to read more
              </p>
            )}
          </div>

          {/* Why this match works */}
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-[color:var(--haevn-navy)]">
              Why this match works
            </h2>
            <p className="mb-6 text-sm text-[color:var(--haevn-charcoal)]">
              A closer look at your alignment
            </p>

            <div className="space-y-0">
              {dims.map((dim) => {
                const isOpen = !!expanded[dim.key] && !isFree
                return (
                  <div
                    key={dim.key}
                    className={`border border-b-0 border-[color:var(--haevn-border)] bg-white last:border-b ${
                      !isFree && !isOpen
                        ? 'transition-colors hover:bg-[color:var(--haevn-dash-surface-alt)]'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleDim(dim.key)}
                      className={`flex w-full items-center justify-between px-5 py-4 text-left ${
                        isFree ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="text-base font-semibold text-[color:var(--haevn-navy)]">
                          {dim.label}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-[color:var(--haevn-charcoal)]">
                          {summaryFor(dim.label, dim.score)}
                        </p>
                      </div>
                      {!isFree && (
                        <ChevronDown
                          size={18}
                          strokeWidth={2}
                          className={`shrink-0 text-[color:var(--haevn-muted-fg)] transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </button>
                    {isOpen && (
                      <div className="border-t border-[color:var(--haevn-border)] px-5 pb-5">
                        <div className="pt-4">
                          <span className="mb-3 inline-block bg-[rgba(0,128,128,0.08)] px-2.5 py-1 text-xs uppercase tracking-wider text-[color:var(--haevn-teal)]">
                            {strengthLabel(dim.score)} · {dim.score}%
                          </span>
                          <ul className="space-y-2">
                            <li className="flex items-start gap-2.5">
                              <Check
                                size={14}
                                strokeWidth={2}
                                className="mt-0.5 shrink-0 text-[color:var(--haevn-teal)]"
                              />
                              <span className="text-sm text-[color:var(--haevn-charcoal)]">
                                {summaryFor(dim.label, dim.score)}
                              </span>
                            </li>
                            <li className="flex items-start gap-2.5">
                              <Check
                                size={14}
                                strokeWidth={2}
                                className="mt-0.5 shrink-0 text-[color:var(--haevn-teal)]"
                              />
                              <span className="text-sm text-[color:var(--haevn-charcoal)]">
                                Scored {dim.score}% on this dimension in your
                                compatibility breakdown.
                              </span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {isFree && (
              <div className="mt-6 text-center">
                <p className="mb-3 text-sm text-[color:var(--haevn-charcoal)]">
                  See full alignment details
                </p>
                <button
                  onClick={() => router.push('/onboarding/membership')}
                  className="haevn-btn-gold text-sm"
                >
                  Unlock with HAEVN+
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isFree && (
            <div className="flex items-center gap-3">
              {handshakeId ? (
                <button
                  onClick={handleMessage}
                  className="flex flex-1 items-center justify-center gap-2 bg-[color:var(--haevn-teal)] py-4 text-sm font-medium tracking-wide text-white transition-colors hover:bg-[color:var(--haevn-teal-hover)]"
                >
                  <MessageCircle size={16} strokeWidth={2} /> Message
                </button>
              ) : requested ? (
                <div className="flex flex-1 items-center justify-center gap-2 bg-[color:var(--haevn-dash-surface-alt)] py-4 text-sm font-medium tracking-wide text-[color:var(--haevn-muted-fg)]">
                  <Check size={16} strokeWidth={2} /> Request sent
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={nudging}
                  className="flex flex-1 items-center justify-center gap-2 bg-[color:var(--haevn-gold)] py-4 text-sm font-medium tracking-wide text-white transition-colors hover:bg-[color:var(--haevn-gold-hover)] disabled:opacity-60"
                >
                  <ArrowRight size={16} strokeWidth={2} />
                  {nudging ? 'Sending…' : 'Connect'}
                </button>
              )}
              <button
                onClick={handlePass}
                aria-label="Pass on this match"
                className="haevn-btn-pass"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* Free-only: Unlock this match */}
        {isFree && (
          <div className="dash-card mt-6 p-6">
            <h3 className="mb-4 text-lg font-semibold text-[color:var(--haevn-navy)]">
              Unlock this match
            </h3>
            <ul className="mb-6 space-y-3">
              {[
                { Icon: Eye, text: 'View photos' },
                { Icon: FileText, text: 'Read full profile' },
                { Icon: BarChart3, text: 'See full alignment breakdown' },
                { Icon: Zap, text: 'Connect instantly' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#F9F5EB] text-[color:var(--haevn-gold)]">
                    <item.Icon size={16} strokeWidth={1.5} />
                  </div>
                  <span className="text-sm text-[color:var(--haevn-charcoal)]">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push('/onboarding/membership')}
              className="haevn-btn-gold w-full text-sm"
            >
              Upgrade to HAEVN+
            </button>
          </div>
        )}

        <div className="h-20 md:h-8" />
      </div>
    </div>
  )
}
