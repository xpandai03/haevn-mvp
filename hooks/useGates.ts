'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useProfile } from './useProfile'
import { createClient } from '@/lib/supabase/client'

interface GateResult {
  isLoading: boolean
  isValid: boolean
  error?: string
  data?: any
}

export function useSurveyGate(): GateResult {
  const [result, setResult] = useState<GateResult>({
    isLoading: true,
    isValid: false
  })
  const router = useRouter()
  const { user } = useAuth()
  const { profile, loading: profileLoading } = useProfile()

  useEffect(() => {
    async function checkSurvey() {
      try {
        if (!user) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Not authenticated'
          })
          router.push('/auth/login')
          return
        }

        if (profileLoading) {
          return // Wait for profile to load
        }

        if (!profile) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Profile not found'
          })
          return
        }

        // Check survey completion from profile
        if (!profile.survey_complete) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Survey incomplete'
          })
          router.push('/onboarding/survey')
          return
        }

        setResult({
          isLoading: false,
          isValid: true,
          data: profile
        })

      } catch (error) {
        console.error('Survey gate error:', error)
        setResult({
          isLoading: false,
          isValid: false,
          error: 'Failed to verify survey status'
        })
      }
    }

    checkSurvey()
  }, [user, profile, profileLoading, router])

  return result
}

export function useCityGate(): GateResult {
  const [result, setResult] = useState<GateResult>({
    isLoading: true,
    isValid: false
  })
  const router = useRouter()
  const { user } = useAuth()
  const { profile, loading: profileLoading } = useProfile()

  useEffect(() => {
    async function checkCity() {
      try {
        if (!user) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Not authenticated'
          })
          router.push('/auth/login')
          return
        }

        if (profileLoading) {
          return // Wait for profile to load
        }

        if (!profile) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Profile not found'
          })
          return
        }

        // Check if city is live from profile
        const isLive = profile.msa_status === 'live'

        if (!isLive) {
          setResult({
            isLoading: false,
            isValid: false,
            error: `${profile.city || 'Your city'} is not yet available. You're on the waitlist!`,
            data: profile
          })
          // Don't redirect, just show message
          return
        }

        setResult({
          isLoading: false,
          isValid: true,
          data: profile
        })

      } catch (error) {
        console.error('City gate error:', error)
        setResult({
          isLoading: false,
          isValid: false,
          error: 'Failed to verify city status'
        })
      }
    }

    checkCity()
  }, [user, profile, profileLoading, router])

  return result
}

export function useMembershipGate(requiredTier: 'plus' | 'select' = 'plus'): GateResult {
  const [result, setResult] = useState<GateResult>({
    isLoading: true,
    isValid: false
  })
  const router = useRouter()
  const { user } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const supabase = createClient()

  useEffect(() => {
    async function checkMembership() {
      try {
        if (!user) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Not authenticated'
          })
          router.push('/auth/login')
          return
        }

        if (profileLoading) {
          return // Wait for profile to load
        }

        let membershipTier = 'free'

        // Check partnership membership tier first
        if (profile?.partnership) {
          membershipTier = profile.partnership.membership_tier || 'free'
        } else {
          // No partnership yet, check user's subscription
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan')
            .eq('user_id', user.id)
            .single()

          if (subscription) {
            membershipTier = subscription.plan
          }
        }

        // Check if user has required tier
        const tierHierarchy = { free: 0, plus: 1, select: 2 }
        const userTierLevel = tierHierarchy[membershipTier as keyof typeof tierHierarchy] || 0
        const requiredLevel = tierHierarchy[requiredTier]

        const hasAccess = userTierLevel >= requiredLevel

        if (!hasAccess) {
          setResult({
            isLoading: false,
            isValid: false,
            error: `Requires ${requiredTier.toUpperCase()} membership`,
            data: { ...profile, membershipTier }
          })
          // Don't redirect, let component handle upgrade CTA
          return
        }

        setResult({
          isLoading: false,
          isValid: true,
          data: { ...profile, membershipTier }
        })

      } catch (error) {
        console.error('Membership gate error:', error)
        setResult({
          isLoading: false,
          isValid: false,
          error: 'Failed to verify membership'
        })
      }
    }

    checkMembership()
  }, [user, profile, profileLoading, requiredTier, router, supabase])

  return result
}