'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import FullPageLoader from '@/components/ui/full-page-loader'

/**
 * Legacy /matches route — redirects to /dashboard/matches which uses
 * the computed_matches pipeline (single source of truth).
 */
export default function MatchesRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/matches')
  }, [router])

  return <FullPageLoader />
}
