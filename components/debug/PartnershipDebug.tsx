'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'

export function PartnershipDebug() {
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [createResult, setCreateResult] = useState<any>(null)

  const fetchDebugData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/partnership')
      const data = await response.json()
      setDebugData(data)
    } catch (error) {
      setDebugData({ error: 'Failed to fetch debug data', details: error })
    }
    setLoading(false)
  }

  const testCreatePartnership = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/partnership', { method: 'POST' })
      const data = await response.json()
      setCreateResult(data)
    } catch (error) {
      setCreateResult({ error: 'Failed to create partnership', details: error })
    }
    setLoading(false)
  }

  const StatusIcon = ({ condition }: { condition: boolean | undefined }) => {
    if (condition === undefined) return <AlertCircle className="h-4 w-4 text-gray-400" />
    return condition ?
      <CheckCircle className="h-4 w-4 text-green-500" /> :
      <XCircle className="h-4 w-4 text-red-500" />
  }

  return (
    <Card className="bg-gray-50 border-2 border-gray-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Debug Panel (Development Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={fetchDebugData}
            size="sm"
            variant="outline"
            disabled={loading}
          >
            Check Database State
          </Button>
          <Button
            onClick={testCreatePartnership}
            size="sm"
            variant="outline"
            disabled={loading}
          >
            Test Create Partnership
          </Button>
        </div>

        {debugData && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <StatusIcon condition={!!debugData.user?.id} />
              <span>User authenticated: {debugData.user?.email || 'Not logged in'}</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon condition={!!debugData.profile?.data} />
              <span>Profile exists: {debugData.profile?.data ? 'Yes' : 'No'}</span>
              {debugData.profile?.error && (
                <span className="text-red-500">({debugData.profile.error.message})</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon condition={!!debugData.membership?.data} />
              <span>Partnership member: {debugData.membership?.data ? 'Yes' : 'No'}</span>
              {debugData.membership?.data && (
                <span className="text-gray-500">
                  (ID: {debugData.membership.data.partnership_id})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon condition={!!debugData.ownedPartnerships?.data?.length} />
              <span>
                Owns partnerships: {debugData.ownedPartnerships?.data?.length || 0}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon condition={!!debugData.surveyResponse?.data} />
              <span>
                Survey exists: {debugData.surveyResponse?.data ?
                  `Yes (${debugData.surveyResponse.data.completion_pct}% complete)` :
                  'No'}
              </span>
            </div>
          </div>
        )}

        {createResult && (
          <div className="mt-4 p-2 bg-white rounded border">
            <div className="text-xs font-semibold mb-1">Partnership Creation Test:</div>
            {createResult.success ? (
              <div className="text-xs text-green-600">
                ✅ Successfully created partnership: {createResult.partnership?.id}
              </div>
            ) : (
              <div className="text-xs text-red-600">
                ❌ Failed: {createResult.error}
                {createResult.details && (
                  <pre className="mt-1 text-xs overflow-auto">
                    {JSON.stringify(createResult.details, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {(debugData || createResult) && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-600">Full Debug Data</summary>
            <pre className="mt-2 p-2 bg-white rounded overflow-auto max-h-60 text-xs">
              {JSON.stringify({ debugData, createResult }, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}