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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { sendHandshakeRequest } from '@/lib/actions/handshakes'
import { Loader2, Send, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TierBadge } from '@/components/TierBadge'

interface SendHandshakeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: {
    partnership: {
      id: string
      display_name: string | null
      short_bio: string | null
      identity: string
      city: string
      age: number
    }
    score: number
    tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  }
  onSuccess?: () => void
}

export function SendHandshakeModal({ open, onOpenChange, match, onSuccess }: SendHandshakeModalProps) {
  const { toast } = useToast()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const getInitials = (name: string | null) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleSend = async () => {
    setSending(true)

    try {
      const result = await sendHandshakeRequest(
        match.partnership.id,
        message.trim() || undefined,
        match.score
      )

      if (result.success) {
        toast({
          title: 'Handshake Sent! 🤝',
          description: `Your request has been sent to ${match.partnership.display_name}. You'll be notified if they accept.`,
        })
        onOpenChange(false)
        setMessage('')
        if (onSuccess) onSuccess()
      } else {
        toast({
          title: 'Failed to Send',
          description: result.error || 'Could not send handshake request',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      console.error('Error sending handshake:', error)
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-h3 text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Send Handshake Request
          </DialogTitle>
          <DialogDescription className="text-body-sm text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Let {match.partnership.display_name} know you're interested in connecting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Match Preview */}
          <div className="flex items-center gap-3 p-3 bg-[#E8E6E3] rounded-lg">
            <Avatar className="h-12 w-12 border-2 border-[#E29E0C]">
              <AvatarImage src={''} />
              <AvatarFallback className="bg-white text-[#252627] font-bold">
                {getInitials(match.partnership.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h4 className="font-bold text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 700 }}>
                {match.partnership.display_name}
              </h4>
              <div className="flex items-center gap-1 text-sm text-[#252627]/60">
                <MapPin className="h-3 w-3" />
                <span>{match.partnership.city}</span>
                <span className="mx-1">•</span>
                <span>{match.partnership.age}</span>
              </div>
            </div>
            <TierBadge tier={match.tier} size="sm" />
          </div>

          {/* Optional Message */}
          <div>
            <label className="text-sm font-medium text-[#252627] mb-2 block" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
              Add a personal message (optional)
            </label>
            <Textarea
              placeholder="Hi! I'd love to connect and learn more about you..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              rows={3}
              className="resize-none border-[#252627]/20"
            />
            <p className="text-xs text-[#252627]/50 mt-1" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              {message.length}/200 characters
            </p>
          </div>

          {/* Info */}
          <div className="bg-[#008080]/10 border border-[#008080]/20 rounded-lg p-3">
            <p className="text-sm text-[#008080]" style={{ fontFamily: 'Roboto', fontWeight: 400 }}>
              💡 If they accept your handshake, you'll both unlock full profiles, photos, and be able to message each other.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="flex-1 border-[#252627]/20"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 bg-gradient-to-r from-[#E29E0C] to-[#D88A0A] hover:from-[#D88A0A] hover:to-[#C77A09] text-white"
            style={{ fontFamily: 'Roboto', fontWeight: 500 }}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Handshake
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
