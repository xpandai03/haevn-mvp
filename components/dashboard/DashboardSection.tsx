'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export interface DashboardSectionProps {
  title: string
  count: number
  totalCount?: number
  viewAllHref: string
  children: React.ReactNode
  emptyMessage?: string
  emptyAction?: {
    label: string
    href: string
  }
}

/**
 * DashboardSection - Container for horizontal scrolling card sections
 * Matches Phase 3 spec section 5: Card Design (Behavior)
 *
 * Features:
 * - Horizontal scroll with snap behavior
 * - "View All" link
 * - Empty state handling
 * - Title with count
 */
export function DashboardSection({
  title,
  count,
  totalCount,
  viewAllHref,
  children,
  emptyMessage,
  emptyAction
}: DashboardSectionProps) {
  const hasItems = count > 0

  return (
    <section className="w-full mb-8">
      {/* Header: Title and View All */}
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
        <h2
          className="text-xl sm:text-2xl font-bold text-haevn-navy"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 700,
            lineHeight: '110%',
            letterSpacing: '-0.015em'
          }}
        >
          {title}
          <span className="text-haevn-charcoal/60 ml-2">
            ({count}{totalCount !== undefined ? ` of ${totalCount}` : ''})
          </span>
        </h2>

        {hasItems && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-haevn-teal hover:opacity-80 transition-opacity"
          >
            <span
              className="text-sm font-medium"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            >
              View All
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Cards Container with Horizontal Scroll */}
      {hasItems ? (
        <div
          className="overflow-x-auto scrollbar-hide px-4 sm:px-6"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="flex gap-4" style={{ scrollSnapAlign: 'start' }}>
            {children}
          </div>
        </div>
      ) : (
        // Empty State
        <div className="px-4 sm:px-6">
          <div className="bg-haevn-gray-50 rounded-2xl p-8 text-center border border-haevn-gray-200">
            <p
              className="text-haevn-charcoal mb-4"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '120%'
              }}
            >
              {emptyMessage || `No ${title.toLowerCase()} yet`}
            </p>
            {emptyAction && (
              <Link href={emptyAction.href}>
                <Button
                  variant="default"
                  className="bg-haevn-teal hover:opacity-90 text-white"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500
                  }}
                >
                  {emptyAction.label}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
