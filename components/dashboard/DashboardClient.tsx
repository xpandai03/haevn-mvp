'use client'

import { useState, useEffect } from 'react'
import { ProfileBannerCard } from './ProfileBannerCard'
import { PhotoManagerModal } from './PhotoManagerModal'
import { CompleteProfileCTA } from './CompleteProfileCTA'

interface DashboardClientProps {
  user: { id: string; email: string }
  profile: { fullName: string; photoUrl?: string } | null
  membershipTier?: 'free' | 'plus'
  stats: {
    matches: number
    messages: number
    connections: number
  }
  showCompleteProfileCTA?: boolean
}

export function DashboardClient({
  user,
  profile,
  membershipTier,
  stats,
  showCompleteProfileCTA = false
}: DashboardClientProps) {
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  // Use prop directly, with local override only when photo is updated via modal
  const [localPhotoOverride, setLocalPhotoOverride] = useState<string | null>(null)

  // Reset local override when server-provided photo changes
  useEffect(() => {
    setLocalPhotoOverride(null)
  }, [profile?.photoUrl])

  // Use local override if set, otherwise use server-provided photo
  const currentPhotoUrl = localPhotoOverride || profile?.photoUrl || null

  const handlePhotoUpdated = (newUrl: string) => {
    setLocalPhotoOverride(newUrl || null)
  }

  const openPhotoManager = () => {
    setPhotoModalOpen(true)
  }

  return (
    <>
      <ProfileBannerCard
        user={user}
        profile={{ ...profile, fullName: profile?.fullName || 'User', photoUrl: currentPhotoUrl || undefined }}
        membershipTier={membershipTier}
        stats={stats}
        onAvatarClick={openPhotoManager}
      />

      {showCompleteProfileCTA && (
        <CompleteProfileCTA onAddPhotosClick={openPhotoManager} />
      )}

      <PhotoManagerModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        onPhotoUpdated={handlePhotoUpdated}
      />
    </>
  )
}
