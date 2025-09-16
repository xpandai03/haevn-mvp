'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    async function checkSurvey() {
      try {
        // Get user data from localStorage
        const userData = localStorage.getItem('haevn_user')

        if (!userData) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Not authenticated'
          })
          router.push('/auth/signup')
          return
        }

        const user = JSON.parse(userData)

        // Check survey completion
        if (!user.surveyCompleted) {
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
          data: user
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
  }, [router])

  return result
}

export function useCityGate(): GateResult {
  const [result, setResult] = useState<GateResult>({
    isLoading: true,
    isValid: false
  })

  useEffect(() => {
    async function checkCity() {
      try {
        // Get user data from localStorage
        const userData = localStorage.getItem('haevn_user')

        if (!userData) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Not authenticated'
          })
          return
        }

        const user = JSON.parse(userData)

        // Check if city is live
        const isLive = user.cityStatus === 'live'

        if (!isLive) {
          setResult({
            isLoading: false,
            isValid: false,
            error: `${user.city} is not yet available. You're on the waitlist!`,
            data: user
          })
          // Don't redirect, just show message
          return
        }

        setResult({
          isLoading: false,
          isValid: true,
          data: user
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
  }, [])

  return result
}

export function useMembershipGate(requiredTier: 'plus' | 'select' = 'plus'): GateResult {
  const [result, setResult] = useState<GateResult>({
    isLoading: true,
    isValid: false
  })

  useEffect(() => {
    async function checkMembership() {
      try {
        // Get user data from localStorage
        const userData = localStorage.getItem('haevn_user')

        if (!userData) {
          setResult({
            isLoading: false,
            isValid: false,
            error: 'Not authenticated'
          })
          return
        }

        const user = JSON.parse(userData)

        // Check if user has required tier
        const tierHierarchy = { free: 0, plus: 1, select: 2 }
        const userTierLevel = tierHierarchy[user.membershipTier] || 0
        const requiredLevel = tierHierarchy[requiredTier]

        const hasAccess = userTierLevel >= requiredLevel

        if (!hasAccess) {
          setResult({
            isLoading: false,
            isValid: false,
            error: `Requires ${requiredTier.toUpperCase()} membership`,
            data: user
          })
          // Don't redirect, let component handle upgrade CTA
          return
        }

        setResult({
          isLoading: false,
          isValid: true,
          data: user
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
  }, [requiredTier])

  return result
}