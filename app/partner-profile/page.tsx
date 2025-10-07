'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { PartnerProfile } from '@/components/PartnerProfile'
import { Loader2 } from 'lucide-react'

export default function PartnerProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Authentication guard - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
          <p className="text-body text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user) {
    return null
  }

  return <PartnerProfile />
}
