'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PartnershipLookup } from './PartnershipLookup'
import { PartnershipCard } from './PartnershipCard'
import { MatchesList } from './MatchesList'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface MatchingControlCenterProps {
  userEmail: string
}

export interface PartnershipData {
  id: string
  display_name: string | null
  profile_state: string | null
  membership_tier: string | null
  profile_type: string | null
  city: string | null
  age: number | null
  structure: any
  survey_completion: number
  user_email: string | null
}

export interface ComputedMatchData {
  id: string
  other_partnership_id: string
  other_display_name: string | null
  other_membership_tier: string | null
  score: number
  tier: string
  breakdown: any
  computed_at: string
  social_state: {
    status: 'not_contacted' | 'nudge_sent' | 'nudge_received' | 'pending' | 'connected' | 'free_blocked'
    handshake_id?: string
    nudge_id?: string
  }
}

interface RecomputeDetail {
  partnershipId: string
  displayName?: string | null
  success: boolean
  matchesComputed: number
  candidatesEvaluated?: number
  error?: string
}

interface RecomputeResult {
  total: number
  computed: number
  errors: number
  details: RecomputeDetail[]
}

export function MatchingControlCenter({ userEmail }: MatchingControlCenterProps) {
  const [selectedPartnership, setSelectedPartnership] = useState<PartnershipData | null>(null)
  const [matches, setMatches] = useState<ComputedMatchData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeResult, setRecomputeResult] = useState<RecomputeResult | null>(null)
  const { toast } = useToast()

  const handlePartnershipSelect = (partnership: PartnershipData, computedMatches: ComputedMatchData[]) => {
    setSelectedPartnership(partnership)
    setMatches(computedMatches)
    setError(null)
  }

  const handleError = (message: string) => {
    setError(message)
    setSelectedPartnership(null)
    setMatches([])
  }

  const handleClear = () => {
    setSelectedPartnership(null)
    setMatches([])
    setError(null)
  }

  const handleRecomputeAll = async () => {
    if (!confirm('This will recompute matches for ALL partnerships. This may take several minutes. Continue?')) {
      return
    }

    setRecomputing(true)
    setRecomputeResult(null)
    try {
      const response = await fetch('/api/admin/recompute-matches', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setRecomputeResult(data.result)
        toast({
          title: 'Matches Recalculated',
          description: `Computed ${data.result.computed} matches for ${data.result.total} partnerships. ${data.result.errors} errors.`,
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to recompute matches',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to recompute matches',
        variant: 'destructive',
      })
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Admin Actions */}
      <Card className="border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-purple-900">Admin Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRecomputeAll}
            disabled={recomputing}
            variant="outline"
            className="w-full"
          >
            {recomputing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recomputing All Matches...
              </>
            ) : (
              'Recompute All Matches'
            )}
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Recalculates matches for all partnerships with completed surveys. This may take several minutes.
          </p>

          {recomputeResult && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <div className={`px-3 py-2 text-sm font-medium ${
                recomputeResult.computed > 0
                  ? 'bg-green-50 text-green-800 border-b border-green-200'
                  : 'bg-amber-50 text-amber-800 border-b border-amber-200'
              }`}>
                {recomputeResult.total} partnerships evaluated | {recomputeResult.computed} matches computed | {recomputeResult.errors} errors
              </div>
              <div className="divide-y text-xs">
                {recomputeResult.details.map((d) => (
                  <div key={d.partnershipId} className={`px-3 py-2 flex items-start gap-2 ${
                    d.error ? 'bg-red-50' : d.matchesComputed > 0 ? 'bg-green-50' : 'bg-gray-50'
                  }`}>
                    <span className="shrink-0 mt-0.5">
                      {d.error ? '!' : d.matchesComputed > 0 ? '+' : '-'}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-gray-800">{d.displayName || 'Unknown'}</span>
                      <span className="font-mono text-gray-400 ml-1">({d.partnershipId.slice(0, 8)})</span>
                      {typeof d.candidatesEvaluated === 'number' && (
                        <span className="text-gray-500 ml-2">{d.candidatesEvaluated} evaluated</span>
                      )}
                      {d.matchesComputed > 0 && (
                        <span className="text-green-700 ml-1">{d.matchesComputed} matches</span>
                      )}
                      {d.error && (
                        <div className="text-red-700 mt-0.5 break-all">{d.error}</div>
                      )}
                      {!d.error && d.matchesComputed === 0 && !d.candidatesEvaluated && (
                        <span className="text-gray-500 ml-2">0 matches (no error reported)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lookup Panel */}
      <Card className="border-purple-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-purple-900">Partnership Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnershipLookup
            onSelect={handlePartnershipSelect}
            onError={handleError}
            onClear={handleClear}
            loading={loading}
            setLoading={setLoading}
          />
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Results Area */}
      {selectedPartnership && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Partnership Info - Left Column */}
          <div className="lg:col-span-1">
            <PartnershipCard partnership={selectedPartnership} />
          </div>

          {/* Matches List - Right Column */}
          <div className="lg:col-span-2">
            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-purple-900">
                    Computed Matches ({matches.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <MatchesList
                  matches={matches}
                  lookupPartnershipId={selectedPartnership.id}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedPartnership && !error && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">Enter an email or partnership ID to begin</p>
          <p className="text-sm">This tool shows system-generated matches and their social state</p>
        </div>
      )}
    </div>
  )
}
