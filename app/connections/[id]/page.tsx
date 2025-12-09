'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Loader2, MoreVertical, AlertTriangle, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getConnectionById, type ConnectionResult } from '@/lib/actions/connections'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MatchDetailBreakdown } from '@/components/matches/MatchDetailBreakdown'

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

// Profile type labels
const PROFILE_TYPE_LABELS: Record<string, string> = {
  solo: 'Solo',
  couple: 'Couple',
  pod: 'Pod',
}

export default function ConnectionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const connectionId = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load connection details
  useEffect(() => {
    async function loadConnection() {
      if (authLoading || !user || !connectionId) return

      try {
        setLoading(true)
        const connectionData = await getConnectionById(connectionId)

        if (!connectionData) {
          setError('Connection not found')
          return
        }

        setConnection(connectionData)
      } catch (err: any) {
        console.error('[ConnectionDetail] Error:', err)
        setError(err.message || 'Failed to load connection')
      } finally {
        setLoading(false)
      }
    }

    loadConnection()
  }, [user, authLoading, connectionId])

  // Handle message action
  const handleMessage = () => {
    if (!connection) return
    router.push(`/chat/${connection.partnership.id}`)
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading connection details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !connection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm text-center">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">
            {error || 'Connection Not Found'}
          </h2>
          <p className="text-haevn-charcoal mb-6">
            This connection may no longer be available or there was an error loading the details.
          </p>
          <Button onClick={() => router.push('/connections')} className="bg-haevn-teal">
            Back to Connections
          </Button>
        </div>
      </div>
    )
  }

  const { partnership, compatibility, matchedAt } = connection

  // Get initials for avatar fallback
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  // Format connection date
  const connectedAgo = formatDistanceToNow(new Date(matchedAt), { addSuffix: true })

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
              <AvatarImage src={partnership.photo_url} alt={partnership.display_name || 'Connection'} />
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
            <span>{PROFILE_TYPE_LABELS[partnership.profile_type] || 'Solo'}</span>
            {partnership.age > 0 && (
              <>
                <span className="mx-1.5">·</span>
                <span>{partnership.age}</span>
              </>
            )}
            <span className="mx-1.5">·</span>
            <span>{partnership.city || 'Unknown'}</span>
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
            className="text-xs text-haevn-charcoal/60 mb-3"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
          >
            {TIER_SUMMARY[compatibility.tier]}
          </p>
          <p
            className="text-xs text-haevn-charcoal/50"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
          >
            Connected {connectedAgo}
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
      </div>

      {/* Fixed Bottom Action - Message Button */}
      <div className="px-5 pb-6 pt-3 bg-white border-t border-haevn-gray-200 flex-shrink-0">
        <Button
          className="w-full h-12 text-base font-semibold bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full flex items-center justify-center gap-2"
          onClick={handleMessage}
        >
          <MessageCircle className="h-5 w-5" />
          MESSAGE
        </Button>
      </div>
    </div>
  )
}
