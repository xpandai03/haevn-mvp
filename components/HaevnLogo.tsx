import Image from 'next/image'

interface HaevnLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * HAEVN Logo Component - Brand Compliant
 *
 * Sizing per brand guidelines:
 * - Minimum height: 75px
 * - sm: 75px (minimum)
 * - md: 96px (default for headers)
 * - lg: 112px (hero/landing)
 *
 * Clearspace: 0.5x logo height on all sides (handled by parent container)
 *
 * Asset: Official SVG wordmark from brand package
 */
export function HaevnLogo({ size = 'md', className = '' }: HaevnLogoProps) {
  const sizeClasses = {
    sm: 'h-[75px]',
    md: 'h-[84px] md:h-[96px]',
    lg: 'h-[96px] md:h-[112px] lg:h-[128px]'
  }

  return (
    <div className={`relative ${sizeClasses[size]} w-auto ${className}`}>
      <Image
        src="/haevn-logo-white.svg"
        alt="HAEVN"
        fill
        style={{ objectFit: 'contain' }}
        priority
        className="block"
      />
    </div>
  )
}
