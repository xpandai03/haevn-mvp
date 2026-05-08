'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Consume-on-entry intent flag. Login/onboarding-completion sets this
// to 'true' right before navigating to /splash; the splash page clears
// it as it boots. If the flag isn't set (direct URL hit, refresh, back
// nav from dashboard), we skip the animation.
const SPLASH_INTENT_FLAG = 'haevn_show_splash'
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

    // Splash plays only when the previous step (login or onboarding
    // completion) set the intent flag. The OAuth callback runs on
    // the server where sessionStorage is unreachable, so it appends
    // ?splash=1 to the URL — accept either signal. Any other entry
    // into /splash (refresh, back-nav, deep-link) goes straight to
    // the dashboard.
    const intent = sessionStorage.getItem(SPLASH_INTENT_FLAG)
    sessionStorage.removeItem(SPLASH_INTENT_FLAG)
    const fromQuery =
      new URLSearchParams(window.location.search).get('splash') === '1'
    if (intent !== 'true' && !fromQuery) {
      router.replace('/dashboard')
      return
    }
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
