'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { User, Users as UsersIcon, UserPlus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'

type ProfileType = 'solo' | 'couple' | 'pod'
type RelationshipOrientation =
  | 'monogamous'
  | 'open'
  | 'polyamorous'
  | 'exploring'
  | 'other'

export default function IdentityPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()
  const supabase = createClient()

  const [profileType, setProfileType] = useState<ProfileType | null>(null)
  const [relationshipOrientation, setRelationshipOrientation] =
    useState<RelationshipOrientation | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userCity, setUserCity] = useState<string>('Austin') // Default city

  // Debug: log state changes
  useEffect(() => {
    console.log('State updated:', { profileType, relationshipOrientation })
  }, [profileType, relationshipOrientation])

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
          .single()

        if (profile?.city) {
          setUserCity(profile.city)
        }

        // Load existing partnership data
        const { data: partnership, error } = await supabase
          .from('partnerships')
          .select('profile_type, relationship_orientation')
          .eq('owner_id', user.id) // Fixed: use owner_id not primary_user_id
          .maybeSingle() // Use maybeSingle to handle no results gracefully

        if (error) {
          console.error('[Identity] Error loading data:', error)
          return
        }

        if (partnership) {
          console.log('[Identity] ✅ Loaded existing data:', partnership)
          setProfileType(partnership.profile_type as ProfileType)
          setRelationshipOrientation(partnership.relationship_orientation as RelationshipOrientation)
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
    if (!user || !profileType || !relationshipOrientation) {
      toast({
        title: 'Selection Required',
        description:
          'Please select both your profile type and relationship orientation.',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    console.log('[Identity] Submitting:', { profileType, relationshipOrientation })

    try {
      // Check if partnership record exists
      const { data: partnership, error: selectError } = await supabase
        .from('partnerships')
        .select('id')
        .eq('owner_id', user.id) // Fixed: use owner_id not primary_user_id
        .maybeSingle() // Use maybeSingle instead of single to handle no results

      if (selectError) {
        console.error('[Identity] Error checking for partnership:', selectError)
        throw selectError
      }

      if (partnership) {
        // UPDATE existing partnership
        console.log('[Identity] Updating existing partnership:', partnership.id)
        const { error: updateError } = await supabase
          .from('partnerships')
          .update({
            profile_type: profileType,
            relationship_orientation: relationshipOrientation,
            updated_at: new Date().toISOString()
          })
          .eq('id', partnership.id)

        if (updateError) {
          console.error('[Identity] Update error:', updateError)
          throw updateError
        }

        console.log('[Identity] ✅ Partnership updated successfully')
      } else {
        // INSERT new partnership
        console.log('[Identity] Creating new partnership record')
        const { error: insertError } = await supabase
          .from('partnerships')
          .insert({
            owner_id: user.id, // Fixed: use owner_id not primary_user_id
            city: userCity, // Get from user's profile
            profile_type: profileType,
            relationship_orientation: relationshipOrientation
          })

        if (insertError) {
          console.error('[Identity] Insert error:', insertError)
          throw insertError
        }

        console.log('[Identity] ✅ Partnership created successfully')
      }

      // Mark step as complete
      await flowController.markStepComplete(user.id, 4)
      console.log('[Identity] Step 4 marked complete')

      // Navigate to next step
      router.push('/onboarding/verification')
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
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
            Who are you on HAEVN?
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

        {/* Relationship Orientation Selection */}
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
            My relationship orientation is...
          </h2>

          <div className="space-y-3">
            {[
              {
                value: 'monogamous',
                label: 'Monogamous',
                description:
                  'Exclusive emotional and physical connection'
              },
              {
                value: 'open',
                label: 'Open',
                description:
                  'Primary partnership with consensual outside connections'
              },
              {
                value: 'polyamorous',
                label: 'Polyamorous',
                description: 'Multiple loving relationships'
              },
              {
                value: 'exploring',
                label: 'Exploring',
                description: 'Still figuring out what works for me'
              },
              {
                value: 'other',
                label: 'Other / Prefer to describe',
                description: "I'll share more in my survey"
              }
            ].map(option => (
              <button
                key={option.value}
                type="button"
                className={`w-full text-left cursor-pointer transition-all p-4 border-2 hover:shadow-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080] focus:ring-offset-2 ${
                  relationshipOrientation === option.value
                    ? 'border-[#008080] bg-[#008080]/5'
                    : 'border-gray-200 hover:border-[#008080]/50'
                }`}
                onClick={(e) => {
                  e.preventDefault()
                  console.log('Selected orientation:', option.value)
                  setRelationshipOrientation(
                    option.value as RelationshipOrientation
                  )
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    console.log('Selected orientation:', option.value, '(keyboard)')
                    setRelationshipOrientation(
                      option.value as RelationshipOrientation
                    )
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      relationshipOrientation === option.value
                        ? 'border-[#008080] bg-[#008080]'
                        : 'border-gray-300'
                    }`}
                  >
                    {relationshipOrientation === option.value && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3
                      className="text-haevn-navy font-medium"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontSize: '16px'
                      }}
                    >
                      {option.label}
                    </h3>
                    <p
                      className="text-haevn-charcoal text-sm"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 300
                      }}
                    >
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleContinue}
            disabled={!profileType || !relationshipOrientation || isSubmitting}
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
