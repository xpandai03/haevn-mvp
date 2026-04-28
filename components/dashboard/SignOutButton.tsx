'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'

export function SignOutButton() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      router.push('/')
      router.refresh()
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
