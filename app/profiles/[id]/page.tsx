'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getProfileData, ProfileData } from '@/lib/actions/profiles'
import { useAuth } from '@/lib/auth/context'

type TabKey = 'about' | 'compatibility' | 'photos'

export default function ProfileViewPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const partnershipId = params.id as string

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('about')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      if (authLoading || !user) return

      try {
        setLoading(true)
        const profileData = await getProfileData(partnershipId)
        
        if (!profileData) {
          setError('Profile not found')
          return
        }

        setProfile(profileData)
        console.log('[ProfileView] Loaded profile:', profileData.displayName)
      } catch (err: any) {
        console.error('[ProfileView] Error:', err)
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [partnershipId, user, authLoading])

  const handleBack = () => {
    router.back()
  }

  // Navigate photo carousel
  const handleNextPhoto = () => {
    if (profile && profile.photos.length > 0) {
      setPhotoIndex((prev) => (prev + 1) % profile.photos.length)
    }
  }

  const handlePrevPhoto = () => {
    if (profile && profile.photos.length > 0) {
      setPhotoIndex((prev) => (prev - 1 + profile.photos.length) % profile.photos.length)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading profile...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">Profile Not Found</h2>
          <p className="text-haevn-charcoal mb-6">{error || 'This profile could not be loaded.'}</p>
          <Button onClick={handleBack} className="w-full bg-haevn-teal">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-haevn-lightgray">
      {/* Header */}
      <header className="bg-white border-b border-haevn-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-haevn-charcoal hover:text-haevn-teal"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-haevn-charcoal hover:text-haevn-teal"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm mb-6">
          {/* Photo Section */}
          <div className="mb-6">
            {profile.photos.length > 0 ? (
              <div className="relative">
                <div className="aspect-square rounded-2xl overflow-hidden bg-haevn-gray-100">
                  <img
                    src={profile.photos[photoIndex]}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                {profile.photos.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handlePrevPhoto}
                      className="rounded-full h-8 w-8 p-0"
                    >
                      ←
                    </Button>
                    <div className="flex gap-1">
                      {profile.photos.map((_, idx) => (
                        <div
                          key={idx}
                          className={'h-2 w-2 rounded-full transition-colors ' + (
                            idx === photoIndex ? 'bg-haevn-teal' : 'bg-white/50'
                          )}
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleNextPhoto}
                      className="rounded-full h-8 w-8 p-0"
                    >
                      →
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-square rounded-2xl overflow-hidden bg-haevn-gray-100 flex items-center justify-center">
                <Avatar className="h-32 w-32">
                  <AvatarFallback className="text-4xl bg-haevn-gray-200 text-haevn-charcoal">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h1
                className="text-3xl font-bold text-haevn-navy"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '-0.015em'
                }}
              >
                {profile.displayName}
              </h1>
              <Badge variant={profile.membershipTier === 'plus' ? 'default' : 'secondary'}>
                {profile.membershipTier === 'plus' ? 'HAEVN+' : 'Free'}
              </Badge>
            </div>

            {profile.city && (
              <p className="text-haevn-charcoal/60">
                📍 {profile.city}
                {profile.distance && ` • ${ profile.distance} miles away`}
              </p>
            )}

            {profile.compatibilityPercentage !== undefined && (
              <div className="bg-haevn-teal/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-haevn-teal">Compatibility</span>
                  <span className="text-2xl font-bold text-haevn-teal">
                    {profile.compatibilityPercentage}%
                  </span>
                </div>
                {profile.topFactor && (
                  <p className="text-sm text-haevn-charcoal/80">
                    Top factor: {profile.topFactor}
                  </p>
                )}
              </div>
            )}

            {profile.bio && (
              <p
                className="text-haevn-charcoal leading-relaxed"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300
                }}
              >
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-3xl shadow-sm mb-6 overflow-hidden">
          <div className="border-b border-haevn-gray-200">
            <div className="flex">
              {(['about', 'compatibility', 'photos'] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={'flex-1 px-4 py-3 text-sm font-medium transition-colors ' + (
                    activeTab === tab
                      ? 'text-haevn-teal border-b-2 border-haevn-teal'
                      : 'text-haevn-charcoal/60 hover:text-haevn-charcoal'
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'about' && (
              <div className="space-y-4">
                <p className="text-haevn-charcoal/60 text-center py-8">
                  Survey data will be displayed here in BATCH 13
                </p>
              </div>
            )}

            {activeTab === 'compatibility' && (
              <div className="space-y-4">
                <p className="text-haevn-charcoal/60 text-center py-8">
                  Detailed compatibility breakdown will be displayed here in BATCH 13
                </p>
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {profile.photos.length > 0 ? (
                  profile.photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="aspect-square rounded-xl overflow-hidden bg-haevn-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setPhotoIndex(idx)}
                    >
                      <img
                        src={photo}
                        alt={'Photo ' + (idx + 1)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))
                ) : (
                  <p className="col-span-full text-haevn-charcoal/60 text-center py-8">
                    No photos available
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons (Placeholder for BATCH 14) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button className="bg-haevn-teal hover:opacity-90 text-white" disabled>
              Message
            </Button>
            <Button variant="outline" className="text-haevn-charcoal" disabled>
              Nudge
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Button variant="outline" className="text-haevn-charcoal" disabled>
              Block
            </Button>
            <Button variant="outline" className="text-haevn-charcoal" disabled>
              Report
            </Button>
          </div>
          <p className="text-sm text-haevn-charcoal/60 text-center mt-4">
            Actions will be implemented in BATCH 14
          </p>
        </div>
      </main>
    </div>
  )
}