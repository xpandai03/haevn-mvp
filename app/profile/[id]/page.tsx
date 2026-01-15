'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Legacy profile view route - redirects to unified /profiles/[id]
 *
 * This ensures all profile views use the same data contract and component:
 * - getPartnershipProfileById() → PartnershipProfileData → ProfileContent
 *
 * This matches what users see in their own "View Match Profile" preview.
 */
export default function ProfileViewRedirect() {
  const params = useParams()
  const router = useRouter()
  const profileId = params.id as string

  useEffect(() => {
    // Redirect to unified profile view
    router.replace(`/profiles/${profileId}`)
  }, [profileId, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
    </div>
  )
}
