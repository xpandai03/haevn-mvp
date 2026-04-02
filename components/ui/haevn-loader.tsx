'use client'

import dynamic from 'next/dynamic'

const DotLottiePlayer = dynamic(
  () => import('@dotlottie/react-player').then((mod) => mod.DotLottiePlayer),
  { ssr: false }
)

interface HaevnLoaderProps {
  size?: number
  className?: string
}

export function HaevnLoader({ size = 120, className = '' }: HaevnLoaderProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div style={{ width: size, height: size }}>
        <DotLottiePlayer
          src="/loading-spinner.lottie"
          autoplay
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}
