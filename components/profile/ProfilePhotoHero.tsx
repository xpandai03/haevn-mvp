'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Camera, Plus, X } from 'lucide-react'

export interface ProfilePhotoHeroProps {
  bannerPhoto: string | null
  avatarPhoto: string | null
  displayName: string
  /** When false, no manage FAB (e.g. public view of someone else). */
  showManagePhotos?: boolean
  manageHref?: string
  children: ReactNode
}

export function ProfilePhotoHero({
  bannerPhoto,
  avatarPhoto,
  displayName,
  showManagePhotos = true,
  manageHref = '/profile/edit',
  children,
}: ProfilePhotoHeroProps) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!expandedUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedUrl(null)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [expandedUrl])

  const hasBanner = Boolean(bannerPhoto)
  const hasAvatar = Boolean(avatarPhoto)
  const initial = displayName.trim().charAt(0).toUpperCase() || 'H'

  return (
    <>
      <div className="bg-white border border-[color:var(--haevn-border)] overflow-hidden">
        {hasBanner ? (
          <button
            type="button"
            onClick={() => setExpandedUrl(bannerPhoto!)}
            className="relative block h-72 w-full cursor-zoom-in sm:h-96 md:h-[28rem] bg-gradient-to-br from-[#F9F5EB] to-haevn-warm-gray overflow-hidden text-left group"
            aria-label="View cover photo larger"
          >
            <img
              src={bannerPhoto!}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </button>
        ) : (
          <Link
            href={manageHref}
            className="relative flex h-72 w-full cursor-pointer flex-col items-center justify-center bg-gradient-to-br from-[#F9F5EB] to-haevn-warm-gray sm:h-96 md:h-[28rem]"
            aria-label="Add a cover photo"
          >
            <Camera
              className="mb-2 h-8 w-8 text-[color:var(--haevn-muted-fg)]"
              strokeWidth={1.5}
            />
            <p className="text-sm text-[color:var(--haevn-muted-fg)]">
              Add a primary photo
            </p>
          </Link>
        )}

        <div className="relative px-6 pb-6">
          <div className="-mt-20 relative z-10 mb-4">
            <div className="relative inline-block h-32 w-32 sm:h-40 sm:w-40">
              <div className="keep-rounded h-full w-full overflow-hidden border-4 border-white bg-[#F9F5EB] shadow-sm">
                {hasAvatar ? (
                  <button
                    type="button"
                    onClick={() => setExpandedUrl(avatarPhoto!)}
                    className="keep-rounded h-full w-full cursor-zoom-in"
                    aria-label="View profile photo larger"
                  >
                    <img
                      src={avatarPhoto!}
                      alt={displayName}
                      className="keep-rounded h-full w-full object-cover"
                      style={{ objectPosition: 'center 20%' }}
                    />
                  </button>
                ) : (
                  <Link
                    href={manageHref}
                    className="flex h-full w-full cursor-pointer items-center justify-center font-heading text-4xl text-[color:var(--haevn-gold)] keep-rounded"
                    aria-label="Add profile photo"
                  >
                    {initial}
                  </Link>
                )}
              </div>

              {showManagePhotos && (
                <Link
                  href={manageHref}
                  className="absolute -bottom-0.5 -right-0.5 z-20 flex h-9 w-9 items-center justify-center rounded-full keep-rounded bg-haevn-orange text-white shadow-md ring-2 ring-white transition-opacity hover:opacity-90"
                  aria-label="Manage photos"
                  title="Manage photos"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} />
                </Link>
              )}
            </div>
          </div>

          {children}
        </div>
      </div>

      {expandedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded photo"
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/80 p-4"
          onClick={() => setExpandedUrl(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedUrl(null)}
            className="absolute right-4 top-4 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:right-6 sm:top-6"
            aria-label="Close"
          >
            <X className="h-7 w-7" strokeWidth={1.5} />
          </button>
          <img
            src={expandedUrl}
            alt={displayName}
            className="max-h-[90vh] max-w-[90vw] cursor-default object-contain keep-rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
