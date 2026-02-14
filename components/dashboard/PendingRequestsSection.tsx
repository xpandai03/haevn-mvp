'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AcceptHandshakeModal } from '@/components/AcceptHandshakeModal'
import type { IncomingRequestCard } from '@/lib/actions/handshakes'

interface PendingRequestsSectionProps {
  requests: IncomingRequestCard[]
}

export function PendingRequestsSection({ requests: initialRequests }: PendingRequestsSectionProps) {
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [selectedRequest, setSelectedRequest] = useState<IncomingRequestCard | null>(null)

  if (requests.length === 0) return null

  return (
    <section className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-gray-900">
          Requests ({requests.length})
        </h3>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative">
        <div className="overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
            {requests.map((req) => (
              <button
                key={req.handshakeId}
                onClick={() => setSelectedRequest(req)}
                className="flex-shrink-0 w-32 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer overflow-hidden text-left"
              >
                {/* Photo */}
                <div className="relative w-full h-24 bg-gray-100">
                  {req.photoUrl ? (
                    <Image
                      src={req.photoUrl}
                      alt={req.displayName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl text-gray-300">
                        {req.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* New indicator */}
                  <div className="absolute top-2 right-2 w-2 h-2 bg-[#E29E0C] rounded-full" />
                </div>

                {/* Info */}
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {req.displayName}
                  </p>
                  {req.city && (
                    <p className="text-[10px] text-gray-500 truncate">
                      {req.city}
                    </p>
                  )}
                  {req.matchScore != null && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-green-600">
                        {req.matchScore}%
                      </span>
                      <span className="text-[10px] text-gray-400">match</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scroll indicator dots */}
        {requests.length > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {requests.slice(0, 5).map((req, i) => (
              <div
                key={req.handshakeId}
                className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-gray-400' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Accept/Decline Modal */}
      {selectedRequest && (
        <AcceptHandshakeModal
          open={!!selectedRequest}
          onOpenChange={(open) => {
            if (!open) setSelectedRequest(null)
          }}
          handshake={{
            id: selectedRequest.handshakeId,
            partnership: {
              id: selectedRequest.partnershipId,
              display_name: selectedRequest.displayName,
              short_bio: selectedRequest.shortBio,
              city: selectedRequest.city ?? '',
              age: selectedRequest.age ?? 0,
              identity: selectedRequest.identity ?? '',
            },
            score: selectedRequest.matchScore ?? undefined,
          }}
          onResponse={() => {
            setRequests((prev) => prev.filter((r) => r.handshakeId !== selectedRequest.handshakeId))
            setSelectedRequest(null)
            router.refresh()
          }}
        />
      )}
    </section>
  )
}
