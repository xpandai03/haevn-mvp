'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { MatchCard } from '@/components/MatchCard'
import { useSurveyGate, useCityGate, useMembershipGate } from '@/hooks/useGates'
import {
  getCurrentUserPartnership,
  getCandidatePartnerships,
  getDemoPartnerships,
  getPartnershipDisplayName,
  type Partnership
} from '@/lib/data/partnerships'
import {
  computeCompatibilityScore,
  getCompatibilityBucket,
  type SurveyAnswers
} from '@/lib/matching/stub'
import { AlertCircle, Lock, Loader2 } from 'lucide-react'

interface MatchedPartnership extends Partnership {
  score: number
  bucket: 'High' | 'Medium' | 'Low'
  displayName: string
}

export default function ConnectionsPage() {
  const router = useRouter()
  const surveyGate = useSurveyGate()
  const cityGate = useCityGate()
  const membershipGate = useMembershipGate('plus')

  const [loading, setLoading] = useState(true)
  const [userPartnership, setUserPartnership] = useState<Partnership | null>(null)
  const [matches, setMatches] = useState<MatchedPartnership[]>([])
  const [currentTab, setCurrentTab] = useState<'High' | 'Medium' | 'Low'>('High')
  const [userTier, setUserTier] = useState<'free' | 'plus' | 'select'>('free')

  useEffect(() => {
    async function loadData() {
      try {
        // Get user's partnership
        const userP = await getCurrentUserPartnership()

        if (!userP) {
          // Use demo data if no real partnership
          const demoPartnerships = await getDemoPartnerships()
          if (demoPartnerships.length > 0) {
            setUserPartnership(demoPartnerships[0])
          }
          setLoading(false)
          return
        }

        setUserPartnership(userP)

        // Get user's tier from localStorage
        const userData = localStorage.getItem('haevn_user')
        if (userData) {
          const user = JSON.parse(userData)
          setUserTier(user.membershipTier || 'free')
        }

        // Get candidate partnerships
        let candidates = await getCandidatePartnerships([userP.id])

        // If no real candidates, use demo data
        if (candidates.length === 0) {
          candidates = await getDemoPartnerships()
          // Filter out user's partnership from demo data
          candidates = candidates.filter(c => c.id !== userP.id)
        }

        // Calculate compatibility scores
        const userAnswers = userP.survey_responses?.[0]?.answers_json || {}

        const scoredMatches = candidates.map(candidate => {
          const candidateAnswers = candidate.survey_responses?.[0]?.answers_json || {}
          const score = computeCompatibilityScore(userAnswers, candidateAnswers)
          const bucket = getCompatibilityBucket(score)
          const displayName = getPartnershipDisplayName(candidate)

          return {
            ...candidate,
            score,
            bucket,
            displayName
          } as MatchedPartnership
        })

        // Sort by score descending
        scoredMatches.sort((a, b) => b.score - a.score)

        setMatches(scoredMatches)
      } catch (error) {
        console.error('Error loading connections:', error)
      } finally {
        setLoading(false)
      }
    }

    // Only load if gates pass
    if (surveyGate.isValid) {
      loadData()
    }
  }, [surveyGate.isValid])

  const handleLikeComplete = (partnershipId: string, matched: boolean, handshakeId?: string) => {
    // Remove from current view after like
    setMatches(prev => prev.filter(m => m.id !== partnershipId))

    // If matched, navigate to chat after a short delay
    if (matched && handshakeId) {
      setTimeout(() => {
        router.push(`/chat/${handshakeId}`)
      }, 2000)
    }
  }

  const handlePass = (partnershipId: string) => {
    // Just remove from current view (in production, track this)
    setMatches(prev => prev.filter(m => m.id !== partnershipId))
  }

  // Show loading state
  if (surveyGate.isLoading || cityGate.isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Check gates
  if (!surveyGate.isValid) {
    return (
      <div className="min-h-screen p-8">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Survey Required</AlertTitle>
          <AlertDescription>
            You must complete your survey before accessing discovery.
            <Button
              className="mt-4"
              onClick={() => router.push('/onboarding/survey')}
            >
              Complete Survey
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!cityGate.isValid) {
    return (
      <div className="min-h-screen p-8">
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>City Not Available</AlertTitle>
          <AlertDescription>
            {cityGate.error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Filter matches by bucket
  const highMatches = matches.filter(m => m.bucket === 'High')
  const mediumMatches = matches.filter(m => m.bucket === 'Medium')
  const lowMatches = matches.filter(m => m.bucket === 'Low')

  const tabCounts = {
    High: highMatches.length,
    Medium: mediumMatches.length,
    Low: lowMatches.length
  }

  const currentMatches = currentTab === 'High' ? highMatches :
                         currentTab === 'Medium' ? mediumMatches : lowMatches

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Connections</h1>
          <p className="text-muted-foreground mt-2">
            Discover compatible partnerships based on your survey responses
          </p>
        </div>

        {/* Membership Notice */}
        {userTier === 'free' && (
          <Alert className="mb-6">
            <Lock className="h-4 w-4" />
            <AlertTitle>Free Account</AlertTitle>
            <AlertDescription>
              You can browse profiles, but need HAEVN+ to send likes and start conversations.
              <Button
                variant="link"
                className="ml-2"
                onClick={() => router.push('/onboarding/membership')}
              >
                Upgrade Now
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Compatibility Buckets Tabs */}
        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="High" className="relative">
              High
              {tabCounts.High > 0 && (
                <Badge className="ml-2 h-5 px-1" variant="default">
                  {tabCounts.High}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="Medium" className="relative">
              Medium
              {tabCounts.Medium > 0 && (
                <Badge className="ml-2 h-5 px-1" variant="secondary">
                  {tabCounts.Medium}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="Low" className="relative">
              Low
              {tabCounts.Low > 0 && (
                <Badge className="ml-2 h-5 px-1" variant="outline">
                  {tabCounts.Low}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={currentTab} className="mt-6">
            {currentMatches.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">
                    No {currentTab.toLowerCase()} compatibility matches at the moment.
                    Check back later or explore other buckets!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {currentMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    partnershipId={match.id}
                    currentPartnershipId={userPartnership?.id || ''}
                    displayName={match.displayName}
                    bio={`Partnership in ${match.city}`}
                    score={match.score}
                    bucket={match.bucket}
                    badges={match.membership_tier === 'select' ? ['Select', 'Verified'] :
                           match.membership_tier === 'plus' ? ['Verified'] : []}
                    onLikeComplete={(matched, handshakeId) => handleLikeComplete(match.id, matched, handshakeId)}
                    onPass={() => handlePass(match.id)}
                    membershipTier={userTier}
                    onUpgrade={() => router.push('/onboarding/membership')}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Stats Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Discovery Stats</CardTitle>
            <CardDescription>Your current matching overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{tabCounts.High}</div>
                <p className="text-xs text-muted-foreground">High Matches</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{tabCounts.Medium}</div>
                <p className="text-xs text-muted-foreground">Medium Matches</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">{tabCounts.Low}</div>
                <p className="text-xs text-muted-foreground">Low Matches</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}