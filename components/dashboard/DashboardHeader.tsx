'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

export function DashboardHeader() {
  const router = useRouter()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <header className="bg-white border-b border-haevn-gray-200 px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Image
          src="/images/haevn-logo-with-icon.png"
          alt="HAEVN"
          width={120}
          height={40}
          className="h-8 sm:h-10 w-auto"
        />

        {/* Sign Out Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-haevn-charcoal hover:text-haevn-teal"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  )
}
