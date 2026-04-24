'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Star, ImageIcon } from 'lucide-react'

interface PhotoLite {
  id: string
  photo_url: string
  is_primary: boolean
}

interface ProfilePhotosSectionProps {
  photos: PhotoLite[]
  maxSlots?: number
}

export function ProfilePhotosSection({
  photos,
  maxSlots = 6,
}: ProfilePhotosSectionProps) {
  const [open, setOpen] = useState(false)
  const count = photos.length

  return (
    <section className="bg-white border border-[color:var(--haevn-border)]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="font-heading text-lg text-[color:var(--haevn-navy)]">
            Your photos
          </h3>
          <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-0.5">
            {count}/{maxSlots} photos · Tap the star to set your primary
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[color:var(--haevn-muted-fg)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="px-5 sm:px-6 pb-6 border-t border-[color:var(--haevn-border)] pt-4">
          {count === 0 ? (
            <div className="py-6 flex flex-col items-start gap-3">
              <div className="w-16 h-16 border border-[color:var(--haevn-border)] flex items-center justify-center bg-[color:var(--haevn-dash-surface-alt)]">
                <ImageIcon
                  className="w-6 h-6 text-[color:var(--haevn-muted-fg)]"
                  strokeWidth={1.25}
                />
              </div>
              <p className="text-sm text-[color:var(--haevn-muted-fg)]">
                You haven&rsquo;t added any photos yet.
              </p>
              <Link href="/profile/edit" className="haevn-btn-teal text-sm">
                Add your first photo
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {Array.from({ length: maxSlots }).map((_, i) => {
                  const photo = photos[i]
                  return photo ? (
                    <div
                      key={photo.id}
                      className="relative aspect-square overflow-hidden border border-[color:var(--haevn-border)]"
                    >
                      <img
                        src={photo.photo_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {photo.is_primary && (
                        <span className="absolute top-1.5 left-1.5 text-[10px] tracking-[0.14em] uppercase text-white bg-[color:var(--haevn-gold)] px-1.5 py-0.5 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5" strokeWidth={2} />
                          Primary
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      key={`empty-${i}`}
                      className="aspect-square border border-dashed border-[color:var(--haevn-border)] bg-[color:var(--haevn-dash-surface-alt)]"
                    />
                  )
                })}
              </div>
              <div className="mt-4">
                <Link
                  href="/profile/edit"
                  className="haevn-btn-secondary text-sm"
                >
                  Manage photos
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
