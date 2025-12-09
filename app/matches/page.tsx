'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getMatchesV2, type ExternalMatchResult, type CompatibilityTier } from '@/lib/actions/matching'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Filter, User, MapPin } from 'lucide-react'
import { HaevnLogo } from '@/components/HaevnLogo'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Tier badge colors
const TIER_COLORS: Record<string, string> = {
  Platinum: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white',
  Gold: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  Silver: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white',
  Bronze: 'bg-gradient-to-r from-amber-700 to-orange-700 text-white',
}

// Top category label lookup
const CATEGORY_LABELS: Record<string, string> = {
  intent: 'Intent & Goals',
  structure: 'Structure Fit',
  connection: 'Connection Style',
  chemistry: 'Sexual Chemistry',
  lifestyle: 'Lifestyle Fit',
}

export default function MatchesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [matches, setMatches] = useState<ExternalMatchResult[]>([])
  const [minTier, setMinTier] = useState<CompatibilityTier>('Bronze')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function loadMatches() {
      if (!user) return

      try {
        setLoading(true)
        const matchData = await getMatchesV2(minTier)
        setMatches(matchData)
      } catch (err: any) {
        console.error('Error loading matches:', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [user, minTier])

  // Navigate to match detail page
  const handleViewMatch = (matchId: string) => {
    router.push(`/matches/${matchId}`)
  }

  // Get top scoring category for a match
  const getTopCategory = (match: ExternalMatchResult): string => {
    const categories = match.compatibility.categories.filter(c => c.included)
    if (categories.length === 0) return 'Compatible'

    const top = categories.reduce((best, cat) =>
      cat.score > best.score ? cat : best
    )
    return CATEGORY_LABELS[top.category] || 'Compatible'
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
          <p className="text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Finding your matches...
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
            Error Loading Matches
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                Your Matches
              </h1>
              <p className="text-body text-[#252627]/70" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                {matches.length} compatible {matches.length === 1 ? 'partnership' : 'partnerships'} found
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#252627]/60" />
              <Select value={minTier} onValueChange={(value: any) => setMinTier(value)}>
                <SelectTrigger className="w-full sm:w-[180px] border-[#252627]/20">
                  <SelectValue placeholder="Minimum tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bronze">Bronze & up</SelectItem>
                  <SelectItem value="Silver">Silver & up</SelectItem>
                  <SelectItem value="Gold">Gold & up</SelectItem>
                  <SelectItem value="Platinum">Platinum only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Matches Grid */}
        {matches.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-[#252627]/20">
              <h3 className="text-h3 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                No matches found
              </h3>
              <p className="text-body text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                Complete your survey or check back later for new matches.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {matches.map((match) => {
              const { partnership, compatibility } = match
              const initials = partnership.display_name
                ?.split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || '??'

              return (
                <div
                  key={partnership.id}
                  onClick={() => handleViewMatch(partnership.id)}
                  className="bg-white rounded-2xl border border-[#252627]/10 p-5 cursor-pointer hover:shadow-lg transition-all duration-200"
                >
                  {/* Header: Avatar + Name */}
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-16 w-16 border-2 border-haevn-teal flex-shrink-0">
                      {partnership.photo_url ? (
                        <AvatarImage src={partnership.photo_url} alt={partnership.display_name || 'Match'} />
                      ) : (
                        <AvatarFallback className="bg-haevn-navy text-white text-lg font-bold">
                          {initials}
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-[#252627] truncate mb-1" style={{ fontFamily: 'Roboto' }}>
                        {partnership.display_name || 'Anonymous'}
                      </h3>
                      <div className="flex items-center gap-1 text-[#252627]/60 text-sm">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{partnership.city || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Compatibility Score */}
                  <div className="mb-3">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-4xl font-bold text-haevn-teal" style={{ fontFamily: 'Roboto' }}>
                        {compatibility.overallScore}%
                      </span>
                      <span className="text-sm text-[#252627]/60">match</span>
                    </div>
                    <Badge className={`${TIER_COLORS[compatibility.tier]} text-xs px-2 py-0.5`}>
                      {compatibility.tier}
                    </Badge>
                  </div>

                  {/* Top Factor */}
                  <p className="text-sm text-[#252627]/70" style={{ fontFamily: 'Roboto', fontWeight: 400 }}>
                    Top match: <span className="font-medium">{getTopCategory(match)}</span>
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
