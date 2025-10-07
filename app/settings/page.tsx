'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to partner-profile (new settings location)
    router.push('/partner-profile')
  }, [router])

  return (
    <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
        <p className="text-body text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
          Redirecting to Partner Profile...
        </p>
      </div>
    </div>
  )
}
