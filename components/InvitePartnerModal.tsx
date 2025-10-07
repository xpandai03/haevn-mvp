'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, CheckCircle, Copy, Check } from 'lucide-react'
import { createPartnershipInvite } from '@/lib/actions/partnership-invites'

interface InvitePartnerModalProps {
  open: boolean
  onClose: () => void
  onInviteSent?: () => void
}

export function InvitePartnerModal({ open, onClose, onInviteSent }: InvitePartnerModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await createPartnershipInvite(email)

      if (result.success && result.inviteCode) {
        setInviteCode(result.inviteCode)
        onInviteSent?.()
      } else {
        setError(result.error || 'Failed to create invitation')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (inviteCode) {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setEmail('')
    setError(null)
    setInviteCode(null)
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3 text-haevn-gray-900">
            {inviteCode ? 'Invitation Sent!' : 'Invite Your Partner'}
          </DialogTitle>
          <DialogDescription className="text-body-sm text-haevn-gray-600">
            {inviteCode
              ? 'Share this code with your partner to join your partnership'
              : 'Enter your partner\'s email to send them an invitation'
            }
          </DialogDescription>
        </DialogHeader>

        {!inviteCode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-email" className="text-body text-haevn-gray-900">
                Partner's Email
              </Label>
              <Input
                id="partner-email"
                type="email"
                placeholder="partner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="border-haevn-gray-300 focus:border-haevn-teal-500"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

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
                disabled={loading || !email}
                className="bg-haevn-teal-600 hover:bg-haevn-teal-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-6">
              <CheckCircle className="h-16 w-16 text-haevn-teal-600" />
            </div>

            <div className="bg-haevn-gray-100 rounded-lg p-4 space-y-2">
              <p className="text-caption text-haevn-gray-600 uppercase tracking-wide">
                Invite Code
              </p>
              <div className="flex items-center justify-between">
                <p className="text-display-sm font-mono text-haevn-gray-900">
                  {inviteCode}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="border-haevn-gray-300"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Alert className="bg-haevn-teal-50 border-haevn-teal-200">
              <AlertDescription className="text-body-sm text-haevn-gray-700">
                Your partner can enter this code when they sign in to HAEVN to join your partnership.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button
                onClick={handleClose}
                className="bg-haevn-teal-600 hover:bg-haevn-teal-700 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
