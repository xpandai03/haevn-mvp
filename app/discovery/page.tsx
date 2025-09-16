'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Heart, X } from 'lucide-react'

export default function DiscoveryPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('haevn_user')

    if (!userData) {
      router.push('/auth/signup')
      return
    }

    const parsed = JSON.parse(userData)

    // Enforce gating rules
    if (!parsed.surveyCompleted) {
      alert('You must complete your survey before accessing discovery')
      router.push('/onboarding/survey')
      return
    }

    if (parsed.membershipTier === 'free') {
      alert('Upgrade to HAEVN+ to access discovery')
      router.push('/onboarding/membership')
      return
    }

    setUser(parsed)
  }, [router])

  if (!user) {
    return <div>Loading...</div>
  }

  // Mock profiles
  const mockProfiles = [
    {
      id: '1',
      name: 'Alex & Jordan',
      type: 'Couple',
      compatibility: 92,
      bucket: 'High',
      badges: ['Verified', 'Founder']
    },
    {
      id: '2',
      name: 'Sam',
      type: 'Single',
      compatibility: 78,
      bucket: 'Medium',
      badges: ['Verified']
    },
    {
      id: '3',
      name: 'Taylor, Morgan & Casey',
      type: 'Throuple',
      compatibility: 85,
      bucket: 'High',
      badges: ['Select']
    }
  ]

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
          <Card className="cursor-pointer hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">High</div>
                <p className="text-sm text-muted-foreground">85%+ match</p>
                <p className="text-xs mt-2">12 profiles</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">Medium</div>
                <p className="text-sm text-muted-foreground">70-84% match</p>
                <p className="text-xs mt-2">28 profiles</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">Low</div>
                <p className="text-sm text-muted-foreground">&lt;70% match</p>
                <p className="text-xs mt-2">45 profiles</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Cards */}
        <div className="space-y-4">
          {mockProfiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{profile.name}</CardTitle>
                    <CardDescription>{profile.type}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{profile.compatibility}%</div>
                    <Badge variant={profile.bucket === 'High' ? 'default' : 'secondary'}>
                      {profile.bucket} Match
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  {profile.badges.map((badge) => (
                    <Badge key={badge} variant="outline">{badge}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-secondary p-4 rounded-lg text-center text-sm text-muted-foreground">
                  Photos hidden until handshake
                </div>
                <div className="flex gap-2 mt-4">
                  <Button className="flex-1" variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Pass
                  </Button>
                  <Button className="flex-1">
                    <Heart className="h-4 w-4 mr-2" />
                    Like
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}