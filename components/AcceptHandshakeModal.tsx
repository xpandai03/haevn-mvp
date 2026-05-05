'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { respondToHandshake } from '@/lib/actions/handshakes'
import { Loader2, Check, X, MapPin, Heart } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface AcceptHandshakeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  handshake: {
    id: string
    partnership: {
      id: string
      display_name: string | null
      short_bio: string | null
      connection_summary?: string | null
      city: string
      age: number
      identity: string
    }
    message?: string
    score?: number
  }
  onResponse?: (accepted: boolean) => void
}

export function AcceptHandshakeModal({ open, onOpenChange, handshake, onResponse }: AcceptHandshakeModalProps) {
  const { toast } = useToast()
  const [responding, setResponding] = useState(false)

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleRespond = async (accept: boolean) => {
    setResponding(true)

    try {
      const result = await respondToHandshake(handshake.id, accept)

      if (result.success) {
        if (accept) {
          toast({
            title: 'Connection Made! 🎉',
            description: `You and ${handshake.partnership.display_name} are now connected! Full profiles and photos are now unlocked.`,
          })
        } else {
          toast({
            title: 'Connection Request Declined',
            description: `You've declined the connection request from ${handshake.partnership.display_name}.`,
          })
        }
        onOpenChange(false)
        if (onResponse) onResponse(accept)
      } else {
        toast({
          title: 'Failed to Respond',
          description: result.error || 'Could not respond to connection request',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      console.error('Error responding to handshake:', error)
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setResponding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-h3 text-haevn-gray-900" style={{ fontWeight: 900 }}>
            Connection Request
          </DialogTitle>
          <DialogDescription className="text-body-sm text-haevn-gray-900/60" style={{ fontWeight: 300 }}>
            {handshake.partnership.display_name} wants to connect with you
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Partnership Preview */}
          <div className="flex items-center gap-3 p-4 bg-[#E8E6E3] rounded-lg">
            <Avatar className="h-16 w-16 border-2 border-haevn-orange">
              <AvatarImage src={''} />
              <AvatarFallback className="bg-white text-haevn-gray-900 text-xl font-bold">
                {getInitials(handshake.partnership.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-haevn-gray-900 mb-1" style={{ fontWeight: 900 }}>
                {handshake.partnership.display_name}
              </h4>
              <div className="flex items-center gap-1 text-sm text-haevn-gray-900/60 mb-2">
                <MapPin className="h-3 w-3" />
                <span>{handshake.partnership.city}</span>
                <span className="mx-1">•</span>
                <span>{handshake.partnership.age}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-haevn-teal/10 text-haevn-teal border-haevn-teal/30 text-xs">
                  {handshake.partnership.identity}
                </Badge>
                {handshake.score && (
                  <div className="flex items-center gap-1 text-xs text-haevn-gray-900/50">
                    <Heart className="h-3 w-3" />
                    <span>{handshake.score}% match</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bio — prefers AI summary */}
          {(handshake.partnership.connection_summary || handshake.partnership.short_bio) && (
            <div className="p-3 bg-white border border-haevn-gray-900/10 rounded-lg">
              <p className="text-sm text-haevn-gray-900/70 line-clamp-3" style={{ fontWeight: 300 }}>
                {handshake.partnership.connection_summary ?? handshake.partnership.short_bio}
              </p>
            </div>
          )}

          {/* Personal Message */}
          {handshake.message && (
            <div className="p-3 bg-haevn-orange/10 border border-haevn-orange/20 rounded-lg">
              <p className="text-xs font-medium text-haevn-gray-900/60 mb-1" style={{ fontWeight: 500 }}>
                Personal Message:
              </p>
              <p className="text-sm text-haevn-gray-900" style={{ fontWeight: 400 }}>
                "{handshake.message}"
              </p>
            </div>
          )}

          {/* Info */}
          <div className="bg-haevn-teal/10 border border-haevn-teal/20 rounded-lg p-3">
            <p className="text-sm text-haevn-teal" style={{ fontWeight: 400 }}>
              ✨ Accepting will unlock full profiles, photos, and messaging for both of you!
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleRespond(false)}
            disabled={responding}
            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
          >
            {responding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-2" />
            )}
            Decline
          </Button>
          <Button
            onClick={() => handleRespond(true)}
            disabled={responding}
            className="flex-1 bg-gradient-to-r from-haevn-teal to-[#006666] hover:from-[#006666] hover:to-[#005555] text-white"
            style={{ fontWeight: 500 }}
          >
            {responding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Responding...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Accept Connection
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
