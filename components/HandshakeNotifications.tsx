'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getIncomingHandshakes, getIncomingHandshakeCount } from '@/lib/actions/handshakes'
import { AcceptHandshakeModal } from './AcceptHandshakeModal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MapPin } from 'lucide-react'

interface HandshakeData {
  id: string
  partnership: {
    id: string
    display_name: string | null
    short_bio: string | null
    city: string
    age: number
    identity: string
  }
  message?: string
  score?: number
}

export function HandshakeNotifications() {
  const [count, setCount] = useState(0)
  const [requests, setRequests] = useState<HandshakeData[]>([])
  const [selectedHandshake, setSelectedHandshake] = useState<HandshakeData | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const loadNotifications = async () => {
    try {
      const [countResult, requestsResult] = await Promise.all([
        getIncomingHandshakeCount(),
        getIncomingHandshakes()
      ])
      setCount(countResult)
      setRequests(requestsResult)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  useEffect(() => {
    loadNotifications()

    // Poll every 30 seconds for updates
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleViewRequest = (handshake: HandshakeData) => {
    setSelectedHandshake(handshake)
    setModalOpen(true)
    setPopoverOpen(false)
  }

  const handleResponse = async () => {
    // Reload notifications after response
    await loadNotifications()
  }

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-[#252627] hover:text-[#008080] hover:bg-[#008080]/10"
          >
            <Bell className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#E29E0C] text-white text-xs font-bold flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4 border-b border-[#252627]/10">
            <h3 className="text-lg font-bold text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              Handshake Requests
            </h3>
            <p className="text-sm text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              {count === 0 ? 'No pending requests' : `${count} ${count === 1 ? 'request' : 'requests'} waiting`}
            </p>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {requests.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-12 w-12 mx-auto text-[#252627]/20 mb-3" />
                <p className="text-sm text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                  No new requests
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#252627]/10">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 hover:bg-[#E8E6E3]/50 cursor-pointer transition-colors"
                    onClick={() => handleViewRequest(request)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 border-2 border-[#E29E0C]">
                        <AvatarImage src={''} />
                        <AvatarFallback className="bg-white text-[#252627] font-bold">
                          {getInitials(request.partnership.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#252627] mb-1" style={{ fontFamily: 'Roboto', fontWeight: 700 }}>
                          {request.partnership.display_name}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-[#252627]/60 mb-2">
                          <MapPin className="h-3 w-3" />
                          <span>{request.partnership.city}</span>
                          <span className="mx-1">•</span>
                          <span>{request.partnership.age}</span>
                        </div>
                        {request.message && (
                          <p className="text-sm text-[#252627]/70 line-clamp-2" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                            "{request.message}"
                          </p>
                        )}
                        <Badge variant="outline" className="bg-[#008080]/10 text-[#008080] border-[#008080]/30 text-xs mt-2">
                          {request.partnership.identity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Accept Handshake Modal */}
      {selectedHandshake && (
        <AcceptHandshakeModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          handshake={selectedHandshake}
          onResponse={handleResponse}
        />
      )}
    </>
  )
}
