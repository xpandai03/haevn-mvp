'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useProfile } from '@/hooks/useProfile'
import { getPartnershipStats, type PartnershipStats } from '@/lib/data/partnershipStats'
import { getPrimaryPhoto } from '@/lib/services/photos'

export interface PartnerData {
  id: string
  name: string
  username: string
  age: number
  role: 'A' | 'B'
  avatar?: string
  isPaid: boolean
  stats: PartnershipStats
  bio: string
  relationshipGoals: string[]
  communicationStyle: {
    primary: string
    description: string
  }
  archetype: {
    name: string
    icon: string
    description: string
  }
}

/**
 * Custom hook to fetch and manage partner profile data
 * Combines data from:
 * - useAuth() for current user
 * - useProfile() for profile and partnership data
 * - getPartnershipStats() for live stats (matches, nudges, connections)
 *
 * GRACEFUL FALLBACK: If no partnership exists, returns profile data with zero stats
 */
export function usePartnerStats() {
  const { user } = useAuth()
  const { profile, loading: profileLoading, error: profileError } = useProfile()
  const [stats, setStats] = useState<PartnershipStats>({
    matches: 0,
    nudges: 0,
    connections: 0,
    profileViews: 0
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [hasPartnership, setHasPartnership] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)

  console.log('🎯 [usePartnerStats] Hook called')
  console.log('🎯 [usePartnerStats] User:', user ? `ID: ${user.id}` : 'No user')
  console.log('🎯 [usePartnerStats] Profile loading:', profileLoading)
  console.log('🎯 [usePartnerStats] Profile:', profile)

  // Fetch stats when partnership data is available
  useEffect(() => {
    async function loadStats() {
      console.log('📊 [usePartnerStats] loadStats called')

      // Wait for user to be loaded
      if (!user) {
        console.log('⚠️ [usePartnerStats] No user yet, waiting...')
        setStatsLoading(false)
        return
      }

      // Wait for profile to finish loading
      if (profileLoading) {
        console.log('⏳ [usePartnerStats] Profile still loading, waiting...')
        return
      }

      // Check if profile exists
      if (!profile) {
        console.log('⚠️ [usePartnerStats] No profile found after loading')
        setStatsLoading(false)
        return
      }

      // Check if partnership exists
      if (!profile.partnership?.id) {
        console.log('ℹ️ [usePartnerStats] No partnership found - using single-user mode')
        console.log('ℹ️ [usePartnerStats] User will see profile with zero stats')
        setHasPartnership(false)
        setStats({
          matches: 0,
          nudges: 0,
          connections: 0,
          profileViews: 0
        })
        setStatsLoading(false)
        return
      }

      try {
        console.log('📡 [usePartnerStats] Fetching stats for partnership:', profile.partnership.id)
        setStatsLoading(true)
        setHasPartnership(true)

        // Fetch stats and primary photo in parallel
        const [partnershipStats, primaryPhoto] = await Promise.all([
          getPartnershipStats(profile.partnership.id),
          getPrimaryPhoto(profile.partnership.id)
        ])

        console.log('✅ [usePartnerStats] Stats loaded:', partnershipStats)
        console.log('📸 [usePartnerStats] Primary photo:', primaryPhoto?.photo_url || 'No avatar set')

        setStats(partnershipStats)
        setAvatarUrl(primaryPhoto?.photo_url)
      } catch (error) {
        console.error('❌ [usePartnerStats] Error loading partnership stats:', error)
        // Keep default stats (all zeros) on error
      } finally {
        setStatsLoading(false)
        console.log('🏁 [usePartnerStats] Stats loading complete')
      }
    }

    loadStats()
  }, [user, profile, profileLoading])

  // Construct the PartnerData object with fallback values
  // GRACEFUL FALLBACK: If user + profile exist, return data even without partnership
  const partnerData: PartnerData | null = user && profile ? {
    id: profile.partnership?.id || profile.user_id,
    name: profile.full_name || 'Unknown',
    username: profile.partnership?.display_name || profile.full_name || user.email?.split('@')[0] || 'User',
    age: 32, // TODO: Add age to profile schema
    role: 'A', // TODO: Determine role from partnership_members
    avatar: avatarUrl, // Use uploaded avatar from primary photo
    isPaid: profile.membership_tier === 'plus' || profile.membership_tier === 'select',
    stats,
    bio: 'Seeking meaningful connections built on trust, communication, and shared growth.', // TODO: Add bio field
    relationshipGoals: [
      'Deep emotional intimacy',
      'Open communication',
      'Shared life experiences',
      'Personal growth together'
    ], // TODO: Pull from survey responses
    communicationStyle: {
      primary: 'Direct & Thoughtful',
      description: 'I prefer clear, honest conversations and appreciate when partners can articulate their needs and boundaries.'
    }, // TODO: Pull from survey responses
    archetype: {
      name: 'The Builder',
      icon: '🏗️',
      description: 'Focused on creating stable foundations and long-term vision in relationships'
    } // TODO: Pull from survey analysis
  } : null

  console.log('🎯 [usePartnerStats] Returning:', {
    hasPartnerData: !!partnerData,
    hasPartnership,
    loading: profileLoading || statsLoading,
    error: profileError
  })

  return {
    partnerData,
    hasPartnership, // NEW: indicates if user has completed partnership setup
    loading: profileLoading || statsLoading,
    error: profileError, // Only return profile errors, not stats errors
    refreshStats: async () => {
      if (profile?.partnership?.id) {
        console.log('🔄 [usePartnerStats] Refreshing stats and avatar...')
        const [newStats, primaryPhoto] = await Promise.all([
          getPartnershipStats(profile.partnership.id),
          getPrimaryPhoto(profile.partnership.id)
        ])
        setStats(newStats)
        setAvatarUrl(primaryPhoto?.photo_url)
        console.log('✅ [usePartnerStats] Stats and avatar refreshed:', newStats, primaryPhoto?.photo_url || 'No avatar')
      } else {
        console.log('ℹ️ [usePartnerStats] Cannot refresh: no partnership ID (single-user mode)')
      }
    }
  }
}
