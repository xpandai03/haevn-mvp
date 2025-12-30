'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FullPageLoader from '@/components/ui/full-page-loader'

export default function SettingsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to partner-profile (new settings location)
    router.push('/partner-profile')
  }, [router])

  return <FullPageLoader />
}
