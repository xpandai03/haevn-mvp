'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  user_id: string
  email: string
  full_name: string | null
  city: string | null
  msa_status: 'live' | 'waitlist'
  survey_complete: boolean
  created_at: string
  partnership?: any
  membership_tier?: string
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      console.log('🔍 [useProfile] Starting profile load...')
      console.log('🔍 [useProfile] User:', user ? `ID: ${user.id}, Email: ${user.email}` : 'No user')

      if (!user) {
        console.log('⚠️ [useProfile] No user found, clearing profile')
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        console.log('📡 [useProfile] Fetching profile from Supabase...')
        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (profileError) {
          console.log('⚠️ [useProfile] Profile query error')
          console.log('⚠️ [useProfile] Error code:', profileError.code)
          console.log('⚠️ [useProfile] Error message:', profileError.message)
          console.log('⚠️ [useProfile] Error details:', profileError.details)
          console.log('⚠️ [useProfile] Full error:', JSON.stringify(profileError, null, 2))

          // Check if it's a "not found" error (PGRST116) - this is normal, we'll create the profile
          if (profileError.code === 'PGRST116' || profileError.message?.includes('No rows')) {
            console.log('ℹ️ [useProfile] Profile not found, creating new profile...')

            // Profile doesn't exist, create it
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                user_id: user.id,
                email: user.email, // Add email field to satisfy NOT NULL constraint
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
                city: user.user_metadata?.city || null,
                msa_status: user.user_metadata?.msa_status || 'waitlist',
                survey_complete: false
              })
              .select()
              .single()

            if (createError) {
              console.error('❌ [useProfile] Failed to create profile')
              console.error('❌ [useProfile] Create error:', JSON.stringify(createError, null, 2))
              throw new Error(`Failed to create profile: ${createError.message || 'Unknown error'}`)
            }
            console.log('✅ [useProfile] Profile created successfully:', newProfile)
            setProfile(newProfile)
          } else {
            // This is a real error (permission, RLS, etc.)
            console.error('❌ [useProfile] Unexpected error loading profile')
            throw new Error(`Profile load failed: ${profileError.message || 'Permission denied or database error'}`)
          }
        } else {
          console.log('✅ [useProfile] Profile loaded successfully:', profileData)
          setProfile(profileData)
        }

        // Get partnership info
        console.log('📡 [useProfile] Fetching partnership data...')
        const { data: partnerships, error: partnershipError } = await supabase
          .from('partnership_members')
          .select(`
            partnership_id,
            partnerships (
              id,
              owner_id,
              city,
              membership_tier,
              display_name,
              profile_state
            )
          `)
          .eq('user_id', user.id)

        if (partnershipError) {
          console.log('⚠️ [useProfile] Partnership query error:', partnershipError.message)
        }

        console.log('📊 [useProfile] Partnership data:', partnerships)

        if (partnerships && partnerships.length > 0) {
          console.log('✅ [useProfile] Partnership found, merging with profile')
          setProfile(prev => prev ? {
            ...prev,
            partnership: partnerships[0].partnerships,
            membership_tier: partnerships[0].partnerships?.membership_tier || 'free'
          } : null)
          console.log('[CLIENT-PROFILE] Profile with partnership loaded:', {
            surveyComplete: profileData.survey_complete,
            hasPartnership: true
          })
        } else {
          console.log('ℹ️ [useProfile] No partnership found for this user')
          console.log('[CLIENT-PROFILE] Profile loaded (no partnership):', {
            surveyComplete: profileData?.survey_complete
          })
        }
      } catch (err) {
        console.error('❌ [useProfile] Error loading profile:', err)
        setError(err as Error)
      } finally {
        console.log('🏁 [useProfile] Profile load complete')
        setLoading(false)
      }
    }

    loadProfile()

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('Profile changed:', payload)
          if (payload.new) {
            setProfile(payload.new as Profile)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user' }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setProfile(data)
      return { data, error: null }
    } catch (error) {
      console.error('Error updating profile:', error)
      return { data: null, error }
    }
  }

  return {
    profile,
    loading,
    error,
    updateProfile
  }
}