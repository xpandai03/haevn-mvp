import Link from 'next/link'

interface MatchesSectionProps {
  totalMatches: number
  currentIndex?: number
}

export function MatchesSection({
  totalMatches,
  currentIndex = 1
}: MatchesSectionProps) {
  return (
    <section className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-gray-900">
          Matches ({currentIndex} of {totalMatches})
        </h3>
        <Link
          href="/dashboard/matches"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          View All
        </Link>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative">
        <div className="overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
            {totalMatches > 0 ? (
              // Placeholder cards - will be replaced with real match data
              Array.from({ length: Math.min(totalMatches, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-32 h-40 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center"
                >
                  <span className="text-xs text-gray-400">Match {i + 1}</span>
                </div>
              ))
            ) : (
              // Empty state
              <div className="w-full py-8 text-center">
                <p className="text-sm text-gray-400">No matches yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator dots */}
        {totalMatches > 0 && (
          <div className="flex justify-center gap-1 mt-2">
            {Array.from({ length: Math.min(totalMatches, 5) }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === 0 ? 'bg-gray-400' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
