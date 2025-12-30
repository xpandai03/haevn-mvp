'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Heart, X, AlertCircle, Sparkles } from 'lucide-react'
import FullPageLoader from '@/components/ui/full-page-loader'
import { useAuth } from '@/lib/auth/context'
import { useProfile } from '@/hooks/useProfile'
import { getDiscoveryProfiles, sendSignal } from '@/lib/services/discovery'
import { useToast } from '@/hooks/use-toast'
import { ensureUserPartnership } from '@/lib/services/partnership'
import type { DiscoveryProfile } from '@/lib/services/discovery'

export default function DiscoveryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { toast } = useToast()
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingLike, setSendingLike] = useState<string | null>(null)
  const [partnershipId, setPartnershipId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  useEffect(() => {
    async function loadDiscovery() {
      if (!user) {
        router.push('/auth/login')
        return
      }

      if (!profile) {
        return // Wait for profile to load
      }

      // Enforce gating rules
      if (!profile.survey_complete) {
        toast({
          title: 'Complete your survey first',
          description: 'You must complete your survey before accessing discovery',
          variant: 'destructive'
        })
        router.push('/onboarding/survey')
        return
      }

      // Ensure user has a partnership
      const { partnership } = await ensureUserPartnership(user.id)
      if (!partnership) {
        toast({
          title: 'Error',
          description: 'Failed to load partnership data',
          variant: 'destructive'
        })
        return
      }

      setPartnershipId(partnership.id)

      // Check membership
      const membershipTier = partnership.membership_tier || 'free'
      if (membershipTier === 'free') {
        toast({
          title: 'Upgrade Required',
          description: 'Upgrade to HAEVN+ to access discovery',
          variant: 'destructive'
        })
        router.push('/onboarding/membership')
        return
      }

      // Load discovery profiles - pass partnershipId to avoid redundant fetch
      const { profiles: discoveryProfiles, error } = await getDiscoveryProfiles(
        user.id,
        profile.city || undefined,
        partnership.id  // Pass already-loaded partnership to avoid 406 errors
      )

      if (error) {
        console.error('Discovery error:', error)
        toast({
          title: 'Error',
          description: 'Failed to load profiles',
          variant: 'destructive'
        })
      } else {
        setProfiles(discoveryProfiles)
      }

      setLoading(false)
    }

    loadDiscovery()
  }, [user, profile, router, toast])

  const handleLike = async (profileId: string) => {
    if (!partnershipId || sendingLike) return

    setSendingLike(profileId)
    try {
      const { error, matched } = await sendSignal(partnershipId, profileId)

      if (error) {
        toast({
          title: 'Error',
          description: error,
          variant: 'destructive'
        })
      } else {
        // Update UI to show liked status
        setProfiles(prev => prev.map(p =>
          p.id === profileId ? { ...p, has_liked: true } : p
        ))

        if (matched) {
          toast({
            title: '🎉 It\'s a match!',
            description: 'You both liked each other! Start chatting now.',
            action: <Button size="sm" onClick={() => router.push('/chat')}>Open Chat</Button>
          })
        } else {
          toast({
            title: 'Like sent!',
            description: 'They\'ll be notified if they like you back.'
          })
        }
      }
    } catch (error) {
      console.error('Like error:', error)
      toast({
        title: 'Error',
        description: 'Failed to send like',
        variant: 'destructive'
      })
    } finally {
      setSendingLike(null)
    }
  }

  const handlePass = (profileId: string) => {
    // Update UI to hide passed profile
    setProfiles(prev => prev.filter(p => p.id !== profileId))
    toast({
      title: 'Passed',
      description: 'This profile won\'t be shown again.'
    })
  }

  if (loading) {
    return <FullPageLoader />
  }

  // Filter profiles based on selected bucket
  const filteredProfiles = filter === 'all'
    ? profiles
    : profiles.filter(p => p.compatibility_bucket === filter)

  // Count profiles by bucket
  const bucketCounts = {
    high: profiles.filter(p => p.compatibility_bucket === 'high').length,
    medium: profiles.filter(p => p.compatibility_bucket === 'medium').length,
    low: profiles.filter(p => p.compatibility_bucket === 'low').length
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Discovery</h1>
            <p className="text-muted-foreground">Find your perfect match</p>
          </div>
        </div>

        {/* Compatibility Buckets */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card
            className={`cursor-pointer hover:shadow-lg transition-all ${
              filter === 'high' ? 'ring-2 ring-green-600' : ''
            }`}
            onClick={() => setFilter(filter === 'high' ? 'all' : 'high')}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">High</div>
                <p className="text-sm text-muted-foreground">85%+ match</p>
                <p className="text-xs mt-2">{bucketCounts.high} profiles</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer hover:shadow-lg transition-all ${
              filter === 'medium' ? 'ring-2 ring-yellow-600' : ''
            }`}
            onClick={() => setFilter(filter === 'medium' ? 'all' : 'medium')}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">Medium</div>
                <p className="text-sm text-muted-foreground">70-84% match</p>
                <p className="text-xs mt-2">{bucketCounts.medium} profiles</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer hover:shadow-lg transition-all ${
              filter === 'low' ? 'ring-2 ring-gray-600' : ''
            }`}
            onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">Low</div>
                <p className="text-sm text-muted-foreground">&lt;70% match</p>
                <p className="text-xs mt-2">{bucketCounts.low} profiles</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Cards */}
        {filteredProfiles.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {filter === 'all'
                    ? 'No profiles available yet'
                    : `No ${filter} compatibility matches`}
                </h3>
                <p className="text-muted-foreground">
                  {filter === 'all'
                    ? 'Check back soon as more people join HAEVN!'
                    : 'Try adjusting your filters to see more profiles.'}
                </p>
                {filter !== 'all' && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setFilter('all')}
                  >
                    Show All Profiles
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProfiles.map((profile) => (
              <Card key={profile.id} className={profile.has_liked ? 'opacity-75' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {profile.display_name}
                        {profile.has_liked && (
                          <Badge variant="secondary" className="text-xs">
                            <Heart className="h-3 w-3 mr-1" />
                            Liked
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {profile.short_bio || 'No bio yet'}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {profile.compatibility_score}%
                      </div>
                      <Badge
                        variant={
                          profile.compatibility_bucket === 'high' ? 'default' :
                          profile.compatibility_bucket === 'medium' ? 'secondary' :
                          'outline'
                        }
                      >
                        {profile.compatibility_bucket} Match
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {profile.lifestyle_tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {profile.badges.map((badge) => (
                      <Badge key={badge}>{badge}</Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-secondary p-4 rounded-lg text-center text-sm text-muted-foreground">
                    Photos hidden until connection
                  </div>
                  {!profile.has_liked && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        className="flex-1"
                        variant="outline"
                        onClick={() => handlePass(profile.id)}
                        disabled={sendingLike === profile.id}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Pass
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => handleLike(profile.id)}
                        disabled={sendingLike === profile.id}
                      >
                        {sendingLike === profile.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Heart className="h-4 w-4 mr-2" />
                            Like
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}