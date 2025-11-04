'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

interface AnimatedIllustrationProps {
  src: string
  loop?: boolean
  autoplay?: boolean
  onComplete?: () => void
  className?: string
  style?: React.CSSProperties
}

export function AnimatedIllustration({
  src,
  loop = false,
  autoplay = true,
  onComplete,
  className = '',
  style = {}
}: AnimatedIllustrationProps) {
  const [animationData, setAnimationData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Load animation data from CDN
  // Note: .lottie files are ZIP archives containing JSON, we need to extract
  useEffect(() => {
    const loadAnimation = async () => {
      try {
        setIsLoading(true)
        setError(false)

        console.log('[AnimatedIllustration] Loading animation from:', src)

        // Check if this is a .lottie file (dotLottie format - ZIP archive)
        const isDotLottie = src.endsWith('.lottie')

        if (isDotLottie) {
          // For .lottie files, we need to fetch as blob and extract JSON
          const response = await fetch(src)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load animation`)
          }

          const blob = await response.blob()
          console.log('[AnimatedIllustration] Fetched .lottie file, size:', blob.size, 'bytes')

          // Use JSZip to extract the animation JSON from the .lottie (ZIP) file
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(blob)

          // dotLottie format has animations in animations/ folder
          const animationFile = zip.file(/animations\/.*\.json$/)[0]
          if (!animationFile) {
            throw new Error('No animation JSON found in .lottie file')
          }

          const jsonString = await animationFile.async('string')
          const data = JSON.parse(jsonString)
          console.log('[AnimatedIllustration] ✅ Animation loaded successfully')
          setAnimationData(data)
        } else {
          // Regular JSON file
          const response = await fetch(src)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load animation`)
          }

          const data = await response.json()
          console.log('[AnimatedIllustration] ✅ JSON animation loaded successfully')
          setAnimationData(data)
        }
      } catch (err: any) {
        console.error('[AnimatedIllustration] ❌ Error loading animation:', err.message)
        console.error('[AnimatedIllustration] Full error:', err)
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    if (src) {
      loadAnimation()
    }
  }, [src])

  // Handle animation completion
  const handleComplete = () => {
    if (onComplete) {
      onComplete()
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <div className="w-8 h-8 border-4 border-haevn-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Error state - show fallback
  if (error || !animationData) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={style}>
        <div className="w-16 h-16 bg-haevn-teal/10 rounded-full flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-haevn-teal rounded-full" />
        </div>
      </div>
    )
  }

  // Respect reduced motion - show static first frame
  if (prefersReducedMotion) {
    return (
      <div className={`flex items-center justify-center opacity-50 ${className}`} style={style}>
        <div className="w-16 h-16 bg-haevn-teal/20 rounded-full" />
      </div>
    )
  }

  return (
    <div className={className} style={style}>
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        onComplete={handleComplete}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
