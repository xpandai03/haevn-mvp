'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, metadata?: any) => Promise<{ data?: any, error?: any }>
  signIn: (email: string, password: string) => Promise<{ data?: any, error?: any }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check active session
    const initAuth = async () => {
      try {
        console.log('[Auth] Initializing auth, checking for existing session...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[Auth] Session check result:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          expiresAt: session?.expires_at
        })
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('[Auth] Error loading session:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] ===== AUTH STATE CHANGE =====')
        console.log('[Auth] Event:', event)
        console.log('[Auth] Session:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at
        })
        console.log('[Auth] Previous user:', user?.id, user?.email)
        console.log('[Auth] ===============================')

        // CRITICAL: Always update state even if user ID is the same
        // This ensures React re-renders and effects re-run
        setSession(session)
        setUser(session?.user ?? null)

        if (event === 'SIGNED_IN') {
          console.log('[Auth] ✅ User signed in:', session?.user?.id)
          console.log('[Auth] Email:', session?.user?.email)
          router.refresh()
        } else if (event === 'SIGNED_OUT') {
          console.log('[Auth] ❌ User signed out, clearing state')
          console.log('[Auth] Previous user was:', user?.id)
          // Explicitly set to null to force state update
          setSession(null)
          setUser(null)
          router.push('/')
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] 🔄 Token refreshed for user:', session?.user?.id)
        } else if (event === 'USER_UPDATED') {
          console.log('[Auth] 📝 User updated:', session?.user?.id)
        } else if (event === 'INITIAL_SESSION') {
          console.log('[Auth] 🎬 Initial session loaded:', session?.user?.id)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  // Proactive session refresh to prevent token expiration
  useEffect(() => {
    if (!session) return

    console.log('[Auth] Setting up proactive session refresh')
    console.log('[Auth] Token expires at:', session.expires_at)

    // Refresh session every 50 minutes (before default 1 hour expiry)
    const refreshInterval = setInterval(async () => {
      console.log('[Auth] ⏰ Proactive token refresh triggered')
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error('[Auth] ❌ Proactive refresh failed:', error)
      } else {
        console.log('[Auth] ✅ Proactive refresh successful')
        console.log('[Auth] New token expires at:', newSession?.expires_at)
        setSession(newSession)
        setUser(newSession?.user ?? null)
      }
    }, 50 * 60 * 1000) // 50 minutes in milliseconds

    console.log('[Auth] Refresh interval set (every 50 minutes)')

    return () => {
      console.log('[Auth] Clearing refresh interval')
      clearInterval(refreshInterval)
    }
  }, [session, supabase])

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      console.log('[Auth] 🆕 Starting signup for:', email)
      console.log('[Auth] Current user before signup:', user?.id, user?.email)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        console.error('[Auth] ❌ Signup error:', error)
        throw error
      }

      console.log('[Auth] ✅ Signup successful!')
      console.log('[Auth] New user ID:', data.user?.id)
      console.log('[Auth] New user email:', data.user?.email)
      console.log('[Auth] Session created:', !!data.session)

      return { data, error: null }
    } catch (error) {
      console.error('[Auth] Signup error:', error)
      return { data: null, error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] 🔐 Starting sign in for:', email)
      console.log('[Auth] Current user before sign in:', user?.id, user?.email)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('[Auth] ❌ Sign in error:', error)
        throw error
      }

      console.log('[Auth] ✅ Sign in successful!')
      console.log('[Auth] User ID:', data.user?.id)
      console.log('[Auth] User email:', data.user?.email)
      console.log('[Auth] Session created:', !!data.session)

      return { data, error: null }
    } catch (error) {
      console.error('[Auth] Sign in error:', error)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      console.log('[Auth] Signing out user:', user?.id)

      // Clear localStorage
      localStorage.removeItem('haevn-auth')
      localStorage.removeItem('haevn_onboarding')

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('[Auth] SignOut error:', error)
      }

      // Clear React state
      setSession(null)
      setUser(null)

      console.log('[Auth] Sign out complete')
    } catch (error) {
      console.error('[Auth] Sign out error:', error)
      // Force clear even on error
      setSession(null)
      setUser(null)
      localStorage.removeItem('haevn-auth')
      localStorage.removeItem('haevn_onboarding')
    }
  }

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) throw error
      setSession(session)
      setUser(session?.user ?? null)
    } catch (error) {
      console.error('Session refresh error:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}