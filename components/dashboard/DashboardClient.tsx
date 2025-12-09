'use client'

import { useState } from 'react'
import { ProfileBannerCard } from './ProfileBannerCard'
import { ProfilePhotoModal } from './ProfilePhotoModal'

interface DashboardClientProps {
  user: { id: string; email: string }
  profile: { fullName: string; photoUrl?: string } | null
  membershipTier?: 'free' | 'plus'
  stats: {
    matches: number
    messages: number
    connections: number
  }
}

export function DashboardClient({
  user,
  profile,
  membershipTier,
  stats
}: DashboardClientProps) {
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(profile?.photoUrl || null)

  const handlePhotoUpdated = (newUrl: string) => {
    setCurrentPhotoUrl(newUrl)
  }

  return (
    <>
      <ProfileBannerCard
        user={user}
        profile={{ ...profile, fullName: profile?.fullName || 'User', photoUrl: currentPhotoUrl || undefined }}
        membershipTier={membershipTier}
        stats={stats}
        onAvatarClick={() => setPhotoModalOpen(true)}
      />

      <ProfilePhotoModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        currentPhotoUrl={currentPhotoUrl}
        onPhotoUpdated={handlePhotoUpdated}
      />
    </>
  )
}
