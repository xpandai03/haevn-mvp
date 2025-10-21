'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ClearSessionDebugPage() {
  const [status, setStatus] = useState<string>('')
  const [cookies, setCookies] = useState<{ name: string, value: string }[]>([])

  const handleListCookies = async () => {
    setStatus('Listing cookies...')
    const { listAllCookies } = await import('@/lib/actions/force-clear-session')
    const result = await listAllCookies()
    setCookies(result)
    setStatus(`Found ${result.length} cookies (see terminal for full list)`)
  }

  const handleForceClear = async () => {
    setStatus('🚨 NUCLEAR CLEAR - Clearing ALL cookies...')

    // Clear localStorage
    console.log('[Debug] Clearing localStorage...')
    localStorage.clear()

    // Clear server cookies
    const { forceClearSession } = await import('@/lib/actions/force-clear-session')
    const { success, clearedCount } = await forceClearSession()

    if (success) {
      setStatus(`✅ SUCCESS! Cleared ${clearedCount} cookies. Reloading page...`)
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } else {
      setStatus('❌ Failed to clear cookies')
    }
  }

  const handleClearAndReload = async () => {
    setStatus('Clearing everything and hard refreshing...')

    // Clear localStorage
    localStorage.clear()

    // Clear session storage
    sessionStorage.clear()

    // Clear server cookies
    const { forceClearSession } = await import('@/lib/actions/force-clear-session')
    await forceClearSession()

    setStatus('Reloading in 1 second...')

    setTimeout(() => {
      // Hard reload (bypasses cache)
      window.location.href = '/?nocache=' + Date.now()
    }, 1000)
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🔧 Session Debug Tools</CardTitle>
            <CardDescription>
              Use these tools to diagnose and fix session persistence issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button onClick={handleListCookies} variant="outline" className="w-full">
                📋 List All Cookies (Check Terminal)
              </Button>
            </div>

            <div>
              <Button onClick={handleForceClear} variant="destructive" className="w-full">
                💣 Nuclear Clear (Delete ALL Cookies)
              </Button>
            </div>

            <div>
              <Button onClick={handleClearAndReload} className="w-full bg-red-600 hover:bg-red-700">
                🔥 Clear Everything + Hard Reload
              </Button>
            </div>

            {status && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="font-mono text-sm">{status}</p>
              </div>
            )}

            {cookies.length > 0 && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                <h3 className="font-semibold mb-2">Cookies Found:</h3>
                <ul className="space-y-1">
                  {cookies.map((cookie, i) => (
                    <li key={i} className="font-mono text-xs">
                      {cookie.name}: {cookie.value.substring(0, 30)}...
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📝 Manual Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <strong>1. Check Browser Cookies:</strong>
              <p className="text-gray-600">DevTools → Application → Cookies → localhost:3001</p>
            </div>

            <div>
              <strong>2. Check localStorage:</strong>
              <p className="text-gray-600">DevTools → Application → Local Storage → localhost:3001</p>
            </div>

            <div>
              <strong>3. Clear Site Data:</strong>
              <p className="text-gray-600">DevTools → Application → Storage → "Clear site data"</p>
            </div>

            <div>
              <strong>4. Hard Refresh:</strong>
              <p className="text-gray-600">Mac: Cmd+Shift+R | Windows: Ctrl+Shift+R</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
