'use client'

import { useState } from 'react'
import { createPartnershipInvite, cancelPartnershipInvite } from '@/lib/actions/partnership-management'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserPlus, Copy, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface InviteResult {
  inviteCode: string
  inviteUrl: string
}

export default function InvitePartnerCard() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInviteResult(null)

    const result = await createPartnershipInvite(email)

    if (result.success && result.inviteCode && result.inviteUrl) {
      setInviteResult({
        inviteCode: result.inviteCode,
        inviteUrl: result.inviteUrl
      })
      toast({
        title: 'Invite created!',
        description: `Invite sent to ${email}. Share the code or link below.`
      })
    } else {
      setError(result.error || 'Failed to create invite')
    }

    setLoading(false)
  }

  const handleCopyLink = async () => {
    if (!inviteResult) return

    try {
      await navigator.clipboard.writeText(inviteResult.inviteUrl)
      setCopied(true)
      toast({
        title: 'Link copied!',
        description: 'Invite link copied to clipboard'
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Please copy the link manually',
        variant: 'destructive'
      })
    }
  }

  const handleCopyCode = async () => {
    if (!inviteResult) return

    try {
      await navigator.clipboard.writeText(inviteResult.inviteCode)
      toast({
        title: 'Code copied!',
        description: 'Invite code copied to clipboard'
      })
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Please copy the code manually',
        variant: 'destructive'
      })
    }
  }

  const handleReset = () => {
    setEmail('')
    setInviteResult(null)
    setError(null)
  }

  return (
    <Card className="rounded-3xl border-haevn-navy/10">
      <CardHeader>
        <CardTitle className="text-haevn-navy flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite a Partner
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!inviteResult ? (
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <div>
              <Label
                htmlFor="partner-email"
                className="text-haevn-navy mb-2 block"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Partner's Email
              </Label>
              <p
                className="text-haevn-charcoal opacity-70 mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '13px',
                  lineHeight: '120%'
                }}
              >
                Enter the email address of the partner you want to invite to your partnership.
              </p>
              <Input
                id="partner-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@example.com"
                required
                className="border-haevn-navy rounded-xl"
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
              size="lg"
              disabled={loading}
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '16px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating invite...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Generate Invite
                </>
              )}
            </Button>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <p
                className="text-blue-800 text-sm"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 400,
                  lineHeight: '140%'
                }}
              >
                💡 Your partner will receive an invite code and link to join your partnership. They'll
                review your shared survey and can approve it to start matching together.
              </p>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Success Message */}
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4
                  className="text-green-900 mb-1"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px'
                  }}
                >
                  Invite Created!
                </h4>
                <p
                  className="text-green-800"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 400,
                    fontSize: '13px'
                  }}
                >
                  Share the link or code below with {email}
                </p>
              </div>
            </div>

            {/* Invite Code */}
            <div className="space-y-2">
              <Label
                className="text-haevn-navy"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Invite Code
              </Label>
              <div className="flex gap-2">
                <Input
                  value={inviteResult.inviteCode}
                  readOnly
                  className="border-haevn-navy rounded-xl font-mono text-lg text-center"
                />
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  className="rounded-xl border-haevn-navy"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Invite Link */}
            <div className="space-y-2">
              <Label
                className="text-haevn-navy"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
              >
                Invite Link
              </Label>
              <div className="flex gap-2">
                <Input
                  value={inviteResult.inviteUrl}
                  readOnly
                  className="border-haevn-navy rounded-xl text-sm"
                />
                <Button
                  onClick={handleCopyLink}
                  className={`rounded-xl ${
                    copied
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-haevn-teal hover:opacity-90'
                  } text-white`}
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3 bg-haevn-lightgray rounded-xl">
              <h5
                className="text-haevn-navy mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '13px'
                }}
              >
                What happens next?
              </h5>
              <ul
                className="text-haevn-charcoal space-y-1 text-sm"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '13px',
                  lineHeight: '140%'
                }}
              >
                <li>1. Your partner creates an account using the link above</li>
                <li>2. They'll review your shared partnership survey</li>
                <li>3. Once approved, they'll have full access to matches & connections</li>
                <li>4. All partners see the same dashboard and data</li>
              </ul>
            </div>

            {/* Create Another Invite */}
            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full rounded-full border-haevn-navy text-haevn-navy"
              size="lg"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Another Partner
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
