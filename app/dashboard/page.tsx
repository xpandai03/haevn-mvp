'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Calendar, BookOpen, Lock, CheckCircle, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const router = useRouter()
  const { user: authUser, signOut } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      if (!authUser) {
        router.push('/auth/login')
        return
      }

      try {
        // Load user profile from database
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (error) {
          console.error('Error loading profile:', error)
          // Profile might not exist yet, create one
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              user_id: authUser.id,
              full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
              city: authUser.user_metadata?.city || 'New York',
              msa_status: authUser.user_metadata?.msa_status || 'waitlist',
              survey_complete: false
            })
            .select()
            .single()

          setProfile(newProfile)
        } else {
          setProfile(profileData)
        }

        // Check for partnership
        const { data: partnerships } = await supabase
          .from('partnership_members')
          .select('partnership_id, partnerships(*)')
          .eq('user_id', authUser.id)

        if (partnerships && partnerships.length > 0) {
          setProfile((prev: any) => ({
            ...prev,
            partnership: partnerships[0].partnerships,
            membershipTier: partnerships[0].partnerships?.membership_tier || 'free'
          }))
        }
      } catch (error) {
        console.error('Error in loadProfile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [authUser, router, supabase])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  const canAccessDiscovery = profile.survey_complete && profile.membershipTier !== 'free'

  const pillars = [
    {
      id: 'connections',
      title: 'Connections',
      description: 'Discover compatible matches',
      icon: Users,
      locked: !profile.survey_complete,
      action: () => {
        if (!profile.survey_complete) {
          alert('Please complete your survey first!')
          router.push('/onboarding/survey')
        } else if (profile.membershipTier === 'free') {
          alert('Upgrade to HAEVN+ to access discovery')
          router.push('/onboarding/membership')
        } else {
          router.push('/connections')
        }
      },
      stats: profile.survey_complete ? 'Ready to explore' : 'Complete survey to unlock'
    },
    {
      id: 'events',
      title: 'Events',
      description: 'Join community gatherings',
      icon: Calendar,
      locked: true,
      action: () => alert('Events coming soon!'),
      stats: 'Coming in Phase 2'
    },
    {
      id: 'resources',
      title: 'Resources',
      description: 'Guides and safety tips',
      icon: BookOpen,
      locked: true,
      action: () => alert('Resources coming soon!'),
      stats: 'Coming in Phase 2'
    }
  ]

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {profile.full_name || 'Friend'}!</h1>
              <p className="text-muted-foreground mt-1">{profile.city || 'Location pending'}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant={profile.membershipTier === 'free' ? 'secondary' : 'default'}>
                {profile.membershipTier === 'free' ? 'Free' : profile.membershipTier === 'plus' ? 'HAEVN+' : 'HAEVN Select'}
              </Badge>
              {profile.msa_status === 'waitlist' && (
                <Badge variant="outline">Waitlist</Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status alerts */}
          {!profile.survey_complete && (
            <Card className="mt-4 border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-900">Complete your survey to unlock features</p>
                    <p className="text-sm text-orange-700 mt-1">
                      You must complete 100% of the survey questions before accessing discovery.
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => router.push('/onboarding/survey')}
                    >
                      Continue Survey
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {profile.survey_complete && profile.membershipTier === 'free' && (
            <Card className="mt-4 border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Survey complete! Upgrade to start connecting</p>
                    <p className="text-sm text-blue-700 mt-1">
                      With HAEVN+, you can browse profiles, send likes, and chat with matches.
                    </p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => router.push('/onboarding/membership')}
                    >
                      Upgrade to HAEVN+
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Three Pillars */}
        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon
            return (
              <Card
                key={pillar.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  pillar.locked ? 'opacity-75' : ''
                }`}
                onClick={pillar.action}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Icon className="h-8 w-8 text-primary" />
                    {pillar.locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <CardTitle className="mt-4">{pillar.title}</CardTitle>
                  <CardDescription>{pillar.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{pillar.stats}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex gap-4">
          <Button variant="outline" onClick={() => router.push('/profile')}>
            Edit Profile
          </Button>
          <Button variant="outline" onClick={() => router.push('/settings')}>
            Settings
          </Button>
          {profile.membershipTier === 'free' && (
            <Button onClick={() => router.push('/onboarding/membership')}>
              Upgrade Membership
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}