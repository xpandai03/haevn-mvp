'use client'

import { useState } from 'react'
import { ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'

export function SignOutButton() {
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      // Hard navigation: router.push raced with Supabase's async cookie
      // clear and the server tree refresh, leaving the user stuck on
      // the current page until manual reload. window.location.replace
      // forces a full page load with cleared cookies and runs the
      // middleware fresh, so the user lands on /auth/login reliably.
      window.location.replace('/auth/login')
    } catch (err) {
      console.error('[Profile] Sign out failed:', err)
      setSigningOut(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left bg-white border border-[color:var(--haevn-border)] hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors disabled:opacity-50"
    >
      <div className="flex items-center gap-4">
        <LogOut
          className="w-5 h-5 text-[color:var(--haevn-muted-fg)] shrink-0"
          strokeWidth={1.5}
        />
        <div>
          <span className="text-sm block text-[color:var(--haevn-charcoal)]">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </span>
          <p className="text-[13px] text-[color:var(--haevn-muted-fg)] mt-0.5">
            Log out of your account
          </p>
        </div>
      </div>
      <ChevronRight
        className="w-4 h-4 text-[color:var(--haevn-muted-fg)] shrink-0"
        strokeWidth={1.5}
      />
    </button>
  )
}
