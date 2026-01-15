'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { MapPin, Users, User } from 'lucide-react'
import Image from 'next/image'
import type { PartnershipProfileData } from '@/lib/actions/partnership-simple'

// Profile type labels
const PROFILE_TYPE_LABELS: Record<string, string> = {
  solo: 'Solo',
  couple: 'Couple',
  pod: 'Pod',
}

interface ProfileContentProps {
  profile: PartnershipProfileData
  isOwnProfile?: boolean
}

/**
 * Shared profile content component used by both:
 * - ProfilePreviewModal (own profile view)
 * - Connected Profile View (viewing other users)
 *
 * IMPORTANT: This ensures pixel-perfect parity between how you see yourself
 * and how connections see you.
 */
export function ProfileContent({ profile, isOwnProfile = false }: ProfileContentProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  // Get structure type label
  const structureType = profile?.structure?.type || profile?.profile_type || 'solo'
  const structureLabel = PROFILE_TYPE_LABELS[structureType] || 'Solo'

  // Get initials for avatar fallback
  const initials = (profile?.display_name || '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  const photos = profile?.photos || []

  return (
    <div className="overflow-y-auto">
      {/* Photo Gallery */}
      {photos.length > 0 ? (
        <div className="relative bg-black">
          <div className="aspect-[4/3] relative">
            <Image
              src={photos[activePhotoIndex]?.photo_url || ''}
              alt={profile.display_name || 'Profile photo'}
              fill
              className="object-cover"
              priority
            />
          </div>
          {/* Photo dots indicator */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActivePhotoIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === activePhotoIndex
                      ? 'bg-white w-4'
                      : 'bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
          {/* Photo navigation arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setActivePhotoIndex(i => (i > 0 ? i - 1 : photos.length - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white"
              >
                ‹
              </button>
              <button
                onClick={() => setActivePhotoIndex(i => (i < photos.length - 1 ? i + 1 : 0))}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white"
              >
                ›
              </button>
            </>
          )}
        </div>
      ) : (
        /* No photos placeholder */
        <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-3xl font-bold text-gray-500">{initials}</span>
            </div>
            <p className="text-sm">No photos yet</p>
          </div>
        </div>
      )}

      {/* Profile Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Name & Basic Info Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1
                className="text-xl font-bold text-haevn-navy"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
              >
                {profile.display_name || 'Anonymous'}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                {structureType === 'couple' || structureType === 'pod' ? (
                  <Users className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span>{structureLabel}</span>
                {profile.age && profile.age > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>{profile.age}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          {profile.city && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <MapPin className="w-4 h-4" />
              <span>{profile.city}</span>
            </div>
          )}
        </div>

        {/* About Section */}
        {(profile.short_bio || profile.long_bio) && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h2
              className="text-sm font-semibold text-haevn-navy mb-2"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
            >
              About
            </h2>
            {profile.short_bio && (
              <p
                className="text-sm text-gray-700 leading-relaxed"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
              >
                {profile.short_bio}
              </p>
            )}
            {profile.long_bio && (
              <p
                className="text-sm text-gray-600 leading-relaxed mt-2"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
              >
                {profile.long_bio}
              </p>
            )}
          </div>
        )}

        {/* Intentions Section */}
        {profile.intentions && profile.intentions.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h2
              className="text-sm font-semibold text-haevn-navy mb-2"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
            >
              Looking For
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.intentions.map(intention => (
                <Badge
                  key={intention}
                  variant="secondary"
                  className="bg-haevn-teal/10 text-haevn-teal hover:bg-haevn-teal/10 cursor-default text-xs"
                >
                  {intention}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Lifestyle Section */}
        {profile.lifestyle_tags && profile.lifestyle_tags.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h2
              className="text-sm font-semibold text-haevn-navy mb-2"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 600 }}
            >
              Lifestyle & Interests
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.lifestyle_tags.map(tag => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-gray-300 text-gray-600 hover:bg-transparent cursor-default text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty state if no content */}
        {!profile.short_bio && !profile.long_bio &&
         (!profile.intentions || profile.intentions.length === 0) &&
         (!profile.lifestyle_tags || profile.lifestyle_tags.length === 0) && (
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">
              {isOwnProfile
                ? 'Your profile details will appear here once your survey data is processed.'
                : 'Profile details not available yet.'}
            </p>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>
    </div>
  )
}
