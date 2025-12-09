'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth/context'
import { SignOutModal } from './SignOutModal'

export function HAEVNHeader() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Sign out failed:', error)
      setIsSigningOut(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="h-14 max-w-md mx-auto px-4 flex items-center justify-center relative">
          {/* Centered Logo */}
          <Image
            src="/images/haevn-logo-with-icon.png"
            alt="HAEVN"
            width={100}
            height={32}
            className="h-7 w-auto"
            priority
          />

          {/* Right-aligned Sign Out Icon */}
          <button
            onClick={() => setShowSignOutModal(true)}
            className="absolute right-4 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </header>

      <SignOutModal
        open={showSignOutModal}
        onOpenChange={setShowSignOutModal}
        onConfirm={handleSignOut}
        isLoading={isSigningOut}
      />
    </>
  )
}
