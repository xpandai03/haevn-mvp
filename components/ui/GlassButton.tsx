'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { getSectionPrimaryColor, getSectionGlow, lightenColor } from '@/lib/theme/colors'
import type { SectionId } from '@/lib/theme/types'

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'back' | 'save' | 'continue'
  sectionId?: SectionId
  children: React.ReactNode
}

/**
 * Glassmorphic button component with section-based color theming
 *
 * Variants:
 * - 'back': Translucent glass with white border
 * - 'save': Translucent glass with white border
 * - 'continue': Filled with section color background
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ variant, sectionId = 'basic_demographics', children, className, disabled, ...props }, ref) => {
    // Get section colors for dynamic theming
    const sectionColor = getSectionPrimaryColor(sectionId)
    const glowColor = getSectionGlow(sectionId)
    const isGradient = sectionColor.includes('gradient')

    // Base glassmorphic styles for back/save buttons
    const glassStyles =
      variant === 'back' || variant === 'save'
        ? 'bg-white/15 backdrop-blur-[12px] border border-white/25 hover:border-white/40'
        : ''

    // Continue button uses section color as background
    const continueStyles =
      variant === 'continue'
        ? `${
            isGradient
              ? 'hover:brightness-110'
              : 'hover:brightness-110'
          } border border-transparent shadow-md`
        : ''

    // Disabled state
    const disabledStyles = disabled
      ? 'opacity-50 cursor-not-allowed pointer-events-none'
      : ''

    // Touch target sizing for accessibility (min 44x44px)
    const baseStyles = cn(
      'relative flex items-center justify-center gap-2',
      'min-w-[44px] min-h-[44px] px-4 py-2',
      'rounded-lg font-medium text-sm',
      'transition-all duration-300 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-haevn-teal',
      glassStyles,
      continueStyles,
      disabledStyles,
      className
    )

    // Dynamic inline styles for section-based colors and hover glow
    const dynamicStyle: React.CSSProperties =
      variant === 'continue'
        ? {
            background: isGradient ? sectionColor : undefined,
            backgroundColor: !isGradient ? sectionColor : undefined,
            color: '#FFFFFF', // White text for continue button (WCAG AAA on all brand colors)
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
          }
        : {
            color: '#1E1E1E', // Near-black text for glass buttons (WCAG AAA contrast)
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
          }

    // Hover glow effect using CSS custom properties
    const hoverGlowStyle = !disabled
      ? ({
          '--hover-glow': glowColor,
        } as React.CSSProperties)
      : {}

    return (
      <button
        ref={ref}
        className={baseStyles}
        style={{ ...dynamicStyle, ...hoverGlowStyle }}
        disabled={disabled}
        {...props}
      >
        {/* Hover glow overlay */}
        {!disabled && (variant === 'back' || variant === 'save') && (
          <style jsx>{`
            button:hover {
              box-shadow: 0 0 16px var(--hover-glow);
            }
          `}</style>
        )}
        {!disabled && variant === 'continue' && (
          <style jsx>{`
            button:hover {
              box-shadow: 0 4px 20px var(--hover-glow);
            }
          `}</style>
        )}

        {children}
      </button>
    )
  }
)

GlassButton.displayName = 'GlassButton'
