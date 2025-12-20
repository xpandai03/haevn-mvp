import Link from 'next/link'
import Image from 'next/image'
import type { ConnectionCardData } from '@/lib/actions/handshakes'

interface ConnectionsSectionProps {
  connections: ConnectionCardData[]
}

export function ConnectionsSection({ connections }: ConnectionsSectionProps) {
  const totalConnections = connections.length

  return (
    <section className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-gray-900">
          Connections ({totalConnections})
        </h3>
        {totalConnections > 0 && (
          <Link
            href="/dashboard/connections"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            View All
          </Link>
        )}
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative">
        <div className="overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
            {totalConnections > 0 ? (
              connections.slice(0, 5).map((connection) => (
                <Link
                  key={connection.id}
                  href={`/profile/${connection.partnershipId}`}
                  className="flex-shrink-0 w-32 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden"
                >
                  {/* Photo */}
                  <div className="relative w-full h-24 bg-gray-100">
                    {connection.photoUrl ? (
                      <Image
                        src={connection.photoUrl}
                        alt={connection.displayName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl text-gray-300">
                          {connection.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {connection.displayName}
                    </p>
                    {connection.city && (
                      <p className="text-[10px] text-gray-500 truncate">
                        {connection.city}
                      </p>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-green-600">
                        {connection.compatibilityScore}%
                      </span>
                      <span className="text-[10px] text-gray-400">match</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              // Empty state
              <div className="w-full py-8 text-center">
                <p className="text-sm text-gray-400">No connections yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator dots */}
        {totalConnections > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {connections.slice(0, 5).map((connection, i) => (
              <div
                key={connection.id}
                className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-gray-400' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
