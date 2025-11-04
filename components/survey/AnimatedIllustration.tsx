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
  useEffect(() => {
    const loadAnimation = async () => {
      try {
        setIsLoading(true)
        setError(false)

        const response = await fetch(src)
        if (!response.ok) {
          throw new Error('Failed to load animation')
        }

        const data = await response.json()
        setAnimationData(data)
      } catch (err) {
        console.error('Error loading Lottie animation:', err)
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
