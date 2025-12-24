'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, MoreVertical, AlertTriangle, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getMatchDetailsV2, type ExternalMatchResult } from '@/lib/actions/matching'
import { sendConnectionRequest, passOnMatch, getMatchStatus, type MatchStatus } from '@/lib/actions/matchActions'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { sendNudge } from '@/lib/actions/nudges'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MatchDetailBreakdown } from '@/components/matches/MatchDetailBreakdown'
import { useToast } from '@/hooks/use-toast'

// Tier label display
const TIER_LABELS: Record<string, string> = {
  Platinum: 'PLATINUM MATCH',
  Gold: 'HIGH MATCH',
  Silver: 'GOOD MATCH',
  Bronze: 'MATCH',
}

// Tier-specific summary messages
const TIER_SUMMARY: Record<string, string> = {
  Platinum: 'Exceptional alignment across all core categories.',
  Gold: 'Strong alignment across most core categories.',
  Silver: 'Good alignment in key areas of compatibility.',
  Bronze: 'Some shared values and compatible areas.',
}

export default function MatchDetailPage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params.matchId as string
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [match, setMatch] = useState<ExternalMatchResult | null>(null)
  const [status, setStatus] = useState<MatchStatus>('none')
  const [viewerTier, setViewerTier] = useState<'free' | 'plus'>('free')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load match details
  useEffect(() => {
    async function loadMatch() {
      if (authLoading || !user || !matchId) return

      try {
        setLoading(true)
        const [matchData, matchStatus, userTier] = await Promise.all([
          getMatchDetailsV2(matchId),
          getMatchStatus(matchId),
          getUserMembershipTier(),
        ])

        if (!matchData) {
          setError('Match not found')
          return
        }

        setMatch(matchData)
        setStatus(matchStatus)
        setViewerTier(userTier)
      } catch (err: any) {
        console.error('[MatchDetail] Error:', err)
        setError(err.message || 'Failed to load match')
      } finally {
        setLoading(false)
      }
    }

    loadMatch()
  }, [user, authLoading, matchId])

  // Handle connect action
  const handleConnect = async () => {
    if (!match) return

    setActionLoading(true)
    try {
      const result = await sendConnectionRequest(
        match.partnership.id,
        match.compatibility.overallScore
      )

      if (result.success) {
        toast({
          title: 'Connection request sent!',
          description: `You've expressed interest in connecting with ${match.partnership.display_name || 'this match'}.`,
        })
        setStatus('pending_sent')
      } else {
        toast({
          title: 'Failed to connect',
          description: result.error || 'Something went wrong',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send connection request',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle send nudge action (Pro viewer → Free target)
  const handleSendNudge = async () => {
    if (!match) return

    setActionLoading(true)
    try {
      const result = await sendNudge(match.partnership.id)

      if (result.success) {
        toast({
          title: 'Nudge sent!',
          description: `You've nudged ${match.partnership.display_name || 'this match'}. They'll be notified of your interest.`,
        })
      } else {
        toast({
          title: 'Failed to send nudge',
          description: result.error || 'Something went wrong',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send nudge',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Handle pass action
  const handlePass = async () => {
    if (!match) return

    setActionLoading(true)
    try {
      const result = await passOnMatch(match.partnership.id)

      if (result.success) {
        toast({
          title: 'Match passed',
          description: 'This match has been removed from your list.',
        })
        // Navigate back to matches
        router.push('/matches')
      } else {
        toast({
          title: 'Failed to pass',
          description: result.error || 'Something went wrong',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to pass on match',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading match details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm text-center">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">
            {error || 'Match Not Found'}
          </h2>
          <p className="text-haevn-charcoal mb-6">
            This match may no longer be available or there was an error loading the details.
          </p>
          <Button onClick={() => router.push('/matches')} className="bg-haevn-teal">
            Back to Matches
          </Button>
        </div>
      </div>
    )
  }

  const { partnership, compatibility } = match

  // Get initials for avatar fallback
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  // Determine action button states
  const canConnect = status === 'none'
  const isPending = status === 'pending_sent'
  const isConnected = status === 'connected'
  const isDismissed = status === 'dismissed'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-haevn-teal h-12 flex items-center justify-between px-4 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-white text-sm font-medium flex items-center gap-1 hover:opacity-80"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button className="text-white hover:opacity-80">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <Avatar className="w-24 h-24 border-4 border-haevn-teal">
            {partnership.photo_url ? (
              <AvatarImage src={partnership.photo_url} alt={partnership.display_name || 'Match'} />
            ) : (
              <AvatarFallback className="bg-haevn-navy text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
        </div>

        {/* Name and Basic Info */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-bold text-haevn-navy mb-1"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
          >
            {partnership.display_name || 'Anonymous'}
          </h1>
          <p
            className="text-sm text-haevn-charcoal/70"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
          >
            <span className="capitalize">{partnership.profile_type}</span>
            <span className="mx-1.5">·</span>
            <span>{partnership.age}</span>
            <span className="mx-1.5">·</span>
            <span>{partnership.city}</span>
          </p>
        </div>

        {/* Compatibility Score Card */}
        <div className="bg-haevn-lightgray rounded-2xl p-6 mb-6 text-center">
          <p
            className="text-xs text-haevn-charcoal/60 uppercase tracking-wider mb-2"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
          >
            Compatibility Score
          </p>
          <p
            className="text-5xl font-bold text-haevn-teal mb-1"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
          >
            {compatibility.overallScore}%
          </p>
          <p
            className="text-sm font-semibold text-haevn-teal uppercase tracking-wide mb-2"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
          >
            {TIER_LABELS[compatibility.tier]}
          </p>
          <p
            className="text-xs text-haevn-charcoal/60"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
          >
            {TIER_SUMMARY[compatibility.tier]}
          </p>
        </div>

        {/* Their Intent Section */}
        {partnership.short_bio && (
          <div className="mb-6">
            <h3
              className="text-sm font-semibold text-haevn-navy mb-2"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
            >
              Their Intent, In Their Words:
            </h3>
            <p
              className="text-sm text-haevn-charcoal leading-relaxed"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
            >
              {partnership.short_bio}
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-haevn-gray-200 my-6" />

        {/* Compatibility Breakdown */}
        <MatchDetailBreakdown
          categories={compatibility.categories}
          lifestyleIncluded={compatibility.lifestyleIncluded}
        />

        {/* Divider */}
        <div className="border-t border-haevn-gray-200 my-6" />

        {/* Safety Reminder */}
        <div className="bg-amber-50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4
                className="text-sm font-semibold text-amber-800 mb-1"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
              >
                Safety Reminder
              </h4>
              <p
                className="text-xs text-amber-700 leading-relaxed"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
              >
                Always meet in a public place for the first time. Trust your instincts and take your time getting to know new connections.
              </p>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {isPending && (
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-blue-700">
              Connection request sent. Waiting for response.
            </p>
          </div>
        )}
        {isConnected && (
          <div className="bg-green-50 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-green-700">
              You're connected! Check your messages to start chatting.
            </p>
          </div>
        )}
        {isDismissed && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-gray-600">
              This match has been passed.
            </p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Actions */}
      {canConnect && (
        <div className="px-5 pb-6 pt-3 bg-white border-t border-haevn-gray-200 flex-shrink-0">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 text-base font-semibold border-2 border-haevn-charcoal/30 text-haevn-charcoal/60 hover:bg-haevn-lightgray rounded-full"
              onClick={handlePass}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'PASS'}
            </Button>
            {/*
              Button logic:
              - FREE viewer → CONNECT (triggers upgrade prompt)
              - PRO viewer + PRO target → CONNECT (sends real request)
              - PRO viewer + FREE target → SEND NUDGE
            */}
            {viewerTier === 'free' ? (
              // Free viewer: show Connect but redirect to upgrade
              <Button
                className="flex-1 h-12 text-base font-semibold bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full"
                onClick={() => {
                  toast({
                    title: 'Upgrade Required',
                    description: 'Upgrade to HAEVN+ to connect with matches.',
                  })
                  router.push('/onboarding/membership')
                }}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'CONNECT'}
              </Button>
            ) : match?.partnership.membership_tier === 'free' ? (
              // Pro viewer + Free target: show Send Nudge
              <Button
                className="flex-1 h-12 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-full"
                onClick={handleSendNudge}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'SEND NUDGE'}
              </Button>
            ) : (
              // Pro viewer + Pro target: show Connect
              <Button
                className="flex-1 h-12 text-base font-semibold bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full"
                onClick={handleConnect}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'CONNECT'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Back button for non-actionable states */}
      {!canConnect && (
        <div className="px-5 pb-6 pt-3 bg-white border-t border-haevn-gray-200 flex-shrink-0">
          <Button
            variant="outline"
            className="w-full h-12 text-base font-semibold rounded-full"
            onClick={() => router.push('/matches')}
          >
            Back to Matches
          </Button>
        </div>
      )}
    </div>
  )
}
