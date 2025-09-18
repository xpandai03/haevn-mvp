'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  user_id: string
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
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (profileError) {
          // Profile doesn't exist, create it
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
              city: user.user_metadata?.city || null,
              msa_status: user.user_metadata?.msa_status || 'waitlist',
              survey_complete: false
            })
            .select()
            .single()

          if (createError) throw createError
          setProfile(newProfile)
        } else {
          setProfile(profileData)
        }

        // Get partnership info
        const { data: partnerships } = await supabase
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

        if (partnerships && partnerships.length > 0) {
          setProfile(prev => prev ? {
            ...prev,
            partnership: partnerships[0].partnerships,
            membership_tier: partnerships[0].partnerships?.membership_tier || 'free'
          } : null)
        }
      } catch (err) {
        console.error('Error loading profile:', err)
        setError(err as Error)
      } finally {
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