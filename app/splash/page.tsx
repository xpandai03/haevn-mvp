'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const SPLASH_FLAG = 'haevn_splash_shown'
const HARD_TIMEOUT_MS = 8000
const AUTOPLAY_PROBE_MS = 1000
const STATIC_FALLBACK_MS = 2000

export default function SplashPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const advancedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [videoStarted, setVideoStarted] = useState(false)
  const [showStaticFallback, setShowStaticFallback] = useState(false)

  const advance = () => {
    if (advancedRef.current) return
    advancedRef.current = true
    router.replace('/dashboard')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (sessionStorage.getItem(SPLASH_FLAG) === 'true') {
      router.replace('/dashboard')
      return
    }
    sessionStorage.setItem(SPLASH_FLAG, 'true')
    setReady(true)

    const hardTimeout = setTimeout(advance, HARD_TIMEOUT_MS)
    return () => clearTimeout(hardTimeout)
    // advance is stable via ref guard
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (!ready) return
    const probe = setTimeout(() => {
      if (!videoStarted) {
        setShowStaticFallback(true)
        setTimeout(advance, STATIC_FALLBACK_MS)
      }
    }, AUTOPLAY_PROBE_MS)
    return () => clearTimeout(probe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, videoStarted])

  if (!ready) return null

  return (
    <div
      role="presentation"
      onClick={advance}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black cursor-pointer"
    >
      {showStaticFallback ? (
        <img
          src="/haevn-logo-white.svg"
          alt="HAEVN"
          className="w-48 sm:w-64 transition-opacity duration-500 opacity-100"
        />
      ) : (
        <video
          ref={videoRef}
          src="/animations/logo-reveal.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onPlay={() => setVideoStarted(true)}
          onEnded={advance}
          onError={advance}
          className="w-full h-full max-w-2xl object-contain"
        />
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          advance()
        }}
        className="absolute bottom-8 right-8 text-sm text-white/40 hover:text-white/70 transition-colors"
        aria-label="Skip animation"
      >
        Skip
      </button>

    </div>
  )
}
