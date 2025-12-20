'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Send, Handshake } from 'lucide-react'

interface ApiResponse {
  success?: boolean
  message?: string
  error?: string
  data?: any
}

export default function DevToolsPage() {
  // Nudge state
  const [recipientUserId, setRecipientUserId] = useState('')
  const [nudgeLoading, setNudgeLoading] = useState(false)
  const [nudgeResult, setNudgeResult] = useState<ApiResponse | null>(null)

  // Connection state
  const [partnershipAId, setPartnershipAId] = useState('')
  const [partnershipBId, setPartnershipBId] = useState('')
  const [matchScore, setMatchScore] = useState('85')
  const [connectionLoading, setConnectionLoading] = useState(false)
  const [connectionResult, setConnectionResult] = useState<ApiResponse | null>(null)

  const sendNudge = async () => {
    if (!recipientUserId.trim()) {
      setNudgeResult({ error: 'Recipient user ID is required' })
      return
    }

    setNudgeLoading(true)
    setNudgeResult(null)

    try {
      const response = await fetch('/api/dev/force-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: recipientUserId.trim() })
      })
      const data = await response.json()
      setNudgeResult(data)
    } catch (err) {
      setNudgeResult({ error: err instanceof Error ? err.message : 'Failed to send nudge' })
    } finally {
      setNudgeLoading(false)
    }
  }

  const createConnection = async () => {
    if (!partnershipAId.trim() || !partnershipBId.trim()) {
      setConnectionResult({ error: 'Both partnership IDs are required' })
      return
    }

    setConnectionLoading(true)
    setConnectionResult(null)

    try {
      const response = await fetch('/api/dev/force-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          a_partnership_id: partnershipAId.trim(),
          b_partnership_id: partnershipBId.trim(),
          match_score: parseInt(matchScore) || 85
        })
      })
      const data = await response.json()
      setConnectionResult(data)
    } catch (err) {
      setConnectionResult({ error: err instanceof Error ? err.message : 'Failed to create connection' })
    } finally {
      setConnectionLoading(false)
    }
  }

  const ResultBadge = ({ result }: { result: ApiResponse | null }) => {
    if (!result) return null
    return (
      <Badge variant={result.success ? 'default' : 'destructive'}>
        {result.success ? 'Success' : 'Error'}
      </Badge>
    )
  }

  const ResultMessage = ({ result }: { result: ApiResponse | null }) => {
    if (!result) return null

    if (result.error) {
      return (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-red-900 dark:text-red-100">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{result.error}</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-green-900 dark:text-green-100">{result.message}</p>
            {result.data && (
              <pre className="text-xs text-green-700 dark:text-green-300 mt-2 overflow-x-auto bg-green-100 dark:bg-green-900 p-2 rounded">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dev Tools</h1>
          <p className="text-muted-foreground">Development utilities for testing HAEVN features</p>
          <Badge variant="outline" className="mt-2">DEV ONLY</Badge>
        </div>

        <div className="space-y-6">
          {/* Send Nudge Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Send Nudge
                  </CardTitle>
                  <CardDescription>
                    Force send a nudge to another user (bypasses HAEVN+ check)
                  </CardDescription>
                </div>
                <ResultBadge result={nudgeResult} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipientUserId">Recipient User ID</Label>
                <Input
                  id="recipientUserId"
                  placeholder="Enter user UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)"
                  value={recipientUserId}
                  onChange={(e) => setRecipientUserId(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The user ID of the person you want to nudge. Current user will be the sender.
                </p>
              </div>

              <Button
                onClick={sendNudge}
                disabled={nudgeLoading || !recipientUserId.trim()}
                className="w-full"
              >
                {nudgeLoading ? 'Sending...' : 'Send Nudge'}
              </Button>

              <ResultMessage result={nudgeResult} />
            </CardContent>
          </Card>

          {/* Create Connection Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Handshake className="h-5 w-5" />
                    Create Connection
                  </CardTitle>
                  <CardDescription>
                    Force create a mutual match between two partnerships
                  </CardDescription>
                </div>
                <ResultBadge result={connectionResult} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="partnershipAId">Partnership A ID</Label>
                  <Input
                    id="partnershipAId"
                    placeholder="First partnership UUID"
                    value={partnershipAId}
                    onChange={(e) => setPartnershipAId(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnershipBId">Partnership B ID</Label>
                  <Input
                    id="partnershipBId"
                    placeholder="Second partnership UUID"
                    value={partnershipBId}
                    onChange={(e) => setPartnershipBId(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="matchScore">Match Score (0-100)</Label>
                <Input
                  id="matchScore"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="85"
                  value={matchScore}
                  onChange={(e) => setMatchScore(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Compatibility score stored with the connection. Default is 85.
                </p>
              </div>

              <Button
                onClick={createConnection}
                disabled={connectionLoading || !partnershipAId.trim() || !partnershipBId.trim()}
                className="w-full"
              >
                {connectionLoading ? 'Creating...' : 'Create Connection'}
              </Button>

              <ResultMessage result={connectionResult} />
            </CardContent>
          </Card>

          {/* Quick Reference */}
          <Card>
            <CardHeader>
              <CardTitle>API Endpoints</CardTitle>
              <CardDescription>Direct API access for scripting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-sm mb-1">Force Nudge</p>
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block">
                  POST /api/dev/force-nudge
                </code>
              </div>
              <div>
                <p className="font-medium text-sm mb-1">Force Connection</p>
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block">
                  POST /api/dev/force-connection
                </code>
              </div>
              <div>
                <p className="font-medium text-sm mb-1">Force Handshake (basic)</p>
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block">
                  POST /api/dev/force-handshake
                </code>
              </div>
              <div>
                <p className="font-medium text-sm mb-1">Seed Data</p>
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded block">
                  POST /api/dev/seed
                </code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
