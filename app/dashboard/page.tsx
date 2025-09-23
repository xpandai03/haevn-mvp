'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Sparkles, Heart, Users, Calendar, LogOut } from 'lucide-react'
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
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profileData) {
          setProfile(profileData)
        } else {
          // Use metadata if profile doesn't exist
          setProfile({
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
            city: authUser.user_metadata?.city || 'Your City',
            survey_complete: true
          })
        }
      } catch (error) {
        console.error('Error loading profile:', error)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading your HAEVN experience...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 pt-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Welcome to HAEVN!
              </h1>
              <p className="text-xl text-muted-foreground mt-2">
                {profile?.full_name || 'Beautiful Soul'} • {profile?.city || 'Your City'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Congratulations Card */}
        <Card className="mb-8 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-2xl text-green-900">
                  Congratulations! You're All Set! 🎉
                </CardTitle>
                <CardDescription className="text-green-700 mt-1">
                  You've successfully completed your onboarding and joined the HAEVN community
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 bg-white/60 rounded-lg">
                <Sparkles className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                <p className="text-sm font-medium">Profile Complete</p>
              </div>
              <div className="text-center p-3 bg-white/60 rounded-lg">
                <Heart className="h-6 w-6 text-pink-600 mx-auto mb-1" />
                <p className="text-sm font-medium">Survey Submitted</p>
              </div>
              <div className="text-center p-3 bg-white/60 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <p className="text-sm font-medium">Member Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Your HAEVN Journey Begins Soon!</CardTitle>
            <CardDescription>
              We're putting the finishing touches on your personalized experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">What's Coming Next:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Personalized match recommendations based on your survey</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Access to exclusive HAEVN events in your area</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Connection with like-minded individuals in your community</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Educational resources and community forums</span>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Launch Timeline</h3>
              </div>
              <p className="text-sm text-purple-700">
                Full platform features will be available soon. We'll notify you via email when your matches are ready!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder Features Grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="opacity-60 cursor-not-allowed">
            <CardHeader>
              <CardTitle className="text-lg">Discover</CardTitle>
              <CardDescription>Find your perfect matches</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Coming Soon</Badge>
            </CardContent>
          </Card>

          <Card className="opacity-60 cursor-not-allowed">
            <CardHeader>
              <CardTitle className="text-lg">Messages</CardTitle>
              <CardDescription>Connect and chat</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Coming Soon</Badge>
            </CardContent>
          </Card>

          <Card className="opacity-60 cursor-not-allowed">
            <CardHeader>
              <CardTitle className="text-lg">Events</CardTitle>
              <CardDescription>Join community gatherings</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">Coming Soon</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Footer Message */}
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Thank you for being an early member of HAEVN.
            Your journey to meaningful connections starts here.
          </p>
        </div>
      </div>
    </div>
  )
}