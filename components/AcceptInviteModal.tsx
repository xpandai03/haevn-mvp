'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Heart } from 'lucide-react'
import { acceptPartnershipInvite } from '@/lib/actions/partnership-invites'

interface AcceptInviteModalProps {
  open: boolean
  onClose: () => void
  onInviteAccepted?: () => void
}

export function AcceptInviteModal({ open, onClose, onInviteAccepted }: AcceptInviteModalProps) {
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await acceptPartnershipInvite(inviteCode.toUpperCase())

      if (result.success) {
        onInviteAccepted?.()
        handleClose()
      } else {
        setError(result.error || 'Failed to accept invitation')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setInviteCode('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3 text-haevn-gray-900">
            Join a Partnership
          </DialogTitle>
          <DialogDescription className="text-body-sm text-haevn-gray-600">
            Enter the 6-character invite code you received
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code" className="text-body text-haevn-gray-900">
              Invite Code
            </Label>
            <Input
              id="invite-code"
              type="text"
              placeholder="ABC123"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              disabled={loading}
              className="border-haevn-gray-300 focus:border-haevn-teal-500 font-mono text-center text-2xl tracking-widest"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert className="bg-haevn-teal-50 border-haevn-teal-200">
            <AlertDescription className="text-body-sm text-haevn-gray-700">
              By joining this partnership, you'll be connected with your partner and can start finding matches together.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-haevn-gray-300 text-haevn-gray-700 hover:bg-haevn-gray-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || inviteCode.length !== 6}
              className="bg-haevn-teal-600 hover:bg-haevn-teal-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Heart className="mr-2 h-4 w-4" />
                  Join Partnership
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
