'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export default function DevHealthPage() {
  const [healthData, setHealthData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/health/supabase')
      const data = await response.json()

      if (!response.ok) {
        setError(`HTTP ${response.status}: ${data.error || 'Unknown error'}`)
      }

      setHealthData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status')
      setHealthData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Supabase Health Check</h1>
          <p className="text-muted-foreground">Development tool to test Supabase connection</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Testing service role client connection</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {healthData && (
                  <Badge variant={healthData.ok ? 'default' : 'destructive'}>
                    {healthData.ok ? 'Connected' : 'Error'}
                  </Badge>
                )}
                <Button
                  onClick={checkHealth}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-100">Connection Error</p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {healthData && (
              <div>
                {healthData.ok && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">Healthy</p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {healthData.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Environment Variables</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={healthData.hasServiceRole ? 'default' : 'destructive'} className="w-5 h-5 p-0 justify-center">
                          {healthData.hasServiceRole ? '✓' : '✗'}
                        </Badge>
                        <span className="text-sm">SUPABASE_SERVICE_ROLE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={healthData.hasPublicUrl ? 'default' : 'destructive'} className="w-5 h-5 p-0 justify-center">
                          {healthData.hasPublicUrl ? '✓' : '✗'}
                        </Badge>
                        <span className="text-sm">NEXT_PUBLIC_SUPABASE_URL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={healthData.hasAnonKey ? 'default' : 'destructive'} className="w-5 h-5 p-0 justify-center">
                          {healthData.hasAnonKey ? '✓' : '✗'}
                        </Badge>
                        <span className="text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Raw JSON Response</h3>
                    <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(healthData, null, 2)}
                    </pre>
                  </div>

                  {healthData.timestamp && (
                    <div className="text-xs text-muted-foreground">
                      Last checked: {new Date(healthData.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-sm text-muted-foreground">
          <p className="font-medium mb-2">API Endpoint:</p>
          <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">/api/health/supabase</code>
          <p className="mt-4">
            This page tests the service role client connection by attempting a simple query.
            The service role key should never be exposed to the client side.
          </p>
        </div>
      </div>
    </div>
  )
}