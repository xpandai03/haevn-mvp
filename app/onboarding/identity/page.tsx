'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { User, Users as UsersIcon, UserPlus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'

type ProfileType = 'solo' | 'couple' | 'pod'

export default function IdentityPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()
  const supabase = createClient()

  const [profileType, setProfileType] = useState<ProfileType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userCity, setUserCity] = useState<string>('Austin') // Default city

  // Debug: log state changes
  useEffect(() => {
    console.log('State updated:', { profileType })
  }, [profileType])

  useEffect(() => {
    if (loading) return // Wait for auth to finish loading
    if (!user) router.push('/auth/login')
  }, [user, loading, router])

  // Load existing identity data when component mounts
  useEffect(() => {
    async function loadIdentityData() {
      if (!user) return

      try {
        console.log('[Identity] Loading existing data for user:', user.id)

        // Load user's city from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('city')
          .eq('id', user.id)
          .maybeSingle() // Use maybeSingle to avoid errors if no profile

        if (profile?.city) {
          setUserCity(profile.city)
        } else {
          console.log('[Identity] No profile city found, using default')
        }

        // Load existing partnership data
        const { data: partnership, error } = await supabase
          .from('partnerships')
          .select('profile_type')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('[Identity] Error loading data:', error)
          return
        }

        if (partnership) {
          console.log('[Identity] ✅ Loaded existing data:', partnership)
          setProfileType(partnership.profile_type as ProfileType)
        } else {
          console.log('[Identity] No existing data found - first time setup')
        }
      } catch (error) {
        console.error('[Identity] Failed to load identity data:', error)
      }
    }

    loadIdentityData()
  }, [user, supabase])

  const handleContinue = async () => {
    if (!user || !profileType) {
      toast({
        title: 'Selection Required',
        description:
          'Please select your profile type.',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    console.log('[Identity] Submitting:', { profileType })

    try {
      // Call API endpoint to save identity data (uses admin client to bypass RLS)
      console.log('[Identity] Calling /api/onboarding/save-identity')
      const response = await fetch('/api/onboarding/save-identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileType,
          city: userCity
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[Identity] API error:', data.error)
        throw new Error(data.error || 'Failed to save identity data')
      }

      console.log('[Identity] ✅ Identity saved successfully:', data.action)
      console.log('[Identity] Partnership ID:', data.partnershipId)

      // Mark step as complete (identity is now step 3)
      await flowController.markStepComplete(user.id, 3)
      console.log('[Identity] Step 3 marked complete')

      // Navigate to relationship orientation page
      router.push('/onboarding/relationship-orientation')
    } catch (error) {
      console.error('[Identity] Error saving identity:', error)
      toast({
        title: 'Error',
        description: 'Failed to save your selection. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8 space-y-3">
          <h1
            className="text-haevn-navy"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '42px',
              lineHeight: '100%',
              letterSpacing: '-0.015em'
            }}
          >
            How would you like to show up here?
          </h1>
          <p
            className="text-haevn-charcoal text-lg"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              lineHeight: '120%'
            }}
          >
            Your answer helps us show you the right people and experiences.
          </p>
        </div>

        {/* Profile Type Selection */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6 mb-6">
          <h2
            className="text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '20px',
              lineHeight: '120%'
            }}
          >
            I am here as...
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Solo */}
            <button
              type="button"
              className={`cursor-pointer transition-all p-6 border-2 hover:shadow-md rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080] focus:ring-offset-2 ${
                profileType === 'solo'
                  ? 'border-[#008080] bg-[#008080]/5'
                  : 'border-gray-200 hover:border-[#008080]/50'
              }`}
              onClick={() => {
                console.log('Selected profileType: solo')
                setProfileType('solo')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  console.log('Selected profileType: solo (keyboard)')
                  setProfileType('solo')
                }
              }}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                    profileType === 'solo'
                      ? 'bg-[#008080]/20'
                      : 'bg-gray-100'
                  }`}
                >
                  <User
                    className={`h-8 w-8 transition-colors ${
                      profileType === 'solo'
                        ? 'text-[#008080]'
                        : 'text-gray-600'
                    }`}
                  />
                </div>
                <div>
                  <h3
                    className="text-haevn-navy font-medium mb-1"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontSize: '18px'
                    }}
                  >
                    Solo
                  </h3>
                  <p
                    className="text-haevn-charcoal text-sm"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300
                    }}
                  >
                    I'm exploring on my own
                  </p>
                </div>
              </div>
            </button>

            {/* Couple */}
            <button
              type="button"
              className={`cursor-pointer transition-all p-6 border-2 hover:shadow-md rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080] focus:ring-offset-2 ${
                profileType === 'couple'
                  ? 'border-[#008080] bg-[#008080]/5'
                  : 'border-gray-200 hover:border-[#008080]/50'
              }`}
              onClick={() => {
                console.log('Selected profileType: couple')
                setProfileType('couple')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  console.log('Selected profileType: couple (keyboard)')
                  setProfileType('couple')
                }
              }}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                    profileType === 'couple'
                      ? 'bg-[#008080]/20'
                      : 'bg-gray-100'
                  }`}
                >
                  <UsersIcon
                    className={`h-8 w-8 transition-colors ${
                      profileType === 'couple'
                        ? 'text-[#008080]'
                        : 'text-gray-600'
                    }`}
                  />
                </div>
                <div>
                  <h3
                    className="text-haevn-navy font-medium mb-1"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontSize: '18px'
                    }}
                  >
                    Couple
                  </h3>
                  <p
                    className="text-haevn-charcoal text-sm"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300
                    }}
                  >
                    We're exploring together
                  </p>
                </div>
              </div>
            </button>

            {/* Pod */}
            <button
              type="button"
              className={`cursor-pointer transition-all p-6 border-2 hover:shadow-md rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080] focus:ring-offset-2 ${
                profileType === 'pod'
                  ? 'border-[#008080] bg-[#008080]/5'
                  : 'border-gray-200 hover:border-[#008080]/50'
              }`}
              onClick={() => {
                console.log('Selected profileType: pod')
                setProfileType('pod')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  console.log('Selected profileType: pod (keyboard)')
                  setProfileType('pod')
                }
              }}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                    profileType === 'pod'
                      ? 'bg-[#008080]/20'
                      : 'bg-gray-100'
                  }`}
                >
                  <UserPlus
                    className={`h-8 w-8 transition-colors ${
                      profileType === 'pod'
                        ? 'text-[#008080]'
                        : 'text-gray-600'
                    }`}
                  />
                </div>
                <div>
                  <h3
                    className="text-haevn-navy font-medium mb-1"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontSize: '18px'
                    }}
                  >
                    Pod
                  </h3>
                  <p
                    className="text-haevn-charcoal text-sm"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 300
                    }}
                  >
                    We're a group or polycule
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleContinue}
            disabled={!profileType || isSubmitting}
            className="w-full max-w-md bg-haevn-teal hover:opacity-90 text-white rounded-full disabled:opacity-50"
            size="lg"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '18px'
            }}
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
