'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, MessageCircle, Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { getConnectionById, type ConnectionResult } from '@/lib/actions/connections'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function ChatWithConnectionPage() {
  const router = useRouter()
  const params = useParams()
  const connectionId = params.connectionId as string
  const { user, loading: authLoading } = useAuth()

  const [connection, setConnection] = useState<ConnectionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load connection details to show partner name
  useEffect(() => {
    async function loadConnection() {
      if (authLoading || !user || !connectionId) return

      try {
        setLoading(true)
        const connectionData = await getConnectionById(connectionId)

        if (!connectionData) {
          setError('Connection not found')
          return
        }

        setConnection(connectionData)
      } catch (err: any) {
        console.error('[ChatWithConnection] Error:', err)
        setError(err.message || 'Failed to load connection')
      } finally {
        setLoading(false)
      }
    }

    loadConnection()
  }, [user, authLoading, connectionId])

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          <p className="text-haevn-charcoal">Loading chat...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !connection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm text-center">
          <h2 className="text-2xl font-bold text-haevn-navy mb-4">
            {error || 'Connection Not Found'}
          </h2>
          <p className="text-haevn-charcoal mb-6">
            This connection may no longer be available.
          </p>
          <Button onClick={() => router.push('/connections')} className="bg-haevn-teal">
            Back to Connections
          </Button>
        </div>
      </div>
    )
  }

  const { partnership } = connection

  // Get initials for avatar fallback
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-haevn-teal h-14 flex items-center justify-between px-4 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-white text-sm font-medium flex items-center gap-1 hover:opacity-80"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 border-2 border-white/50">
            {partnership.photo_url ? (
              <AvatarImage src={partnership.photo_url} alt={partnership.display_name || 'Connection'} />
            ) : (
              <AvatarFallback className="bg-haevn-navy text-white text-xs font-bold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <span
            className="text-white font-medium"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
          >
            {partnership.display_name || 'Anonymous'}
          </span>
        </div>
        <div className="w-5" /> {/* Spacer for centering */}
      </header>

      {/* Coming Soon Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="bg-haevn-teal/10 rounded-full p-6 inline-block mb-6">
            <Construction className="h-12 w-12 text-haevn-teal" />
          </div>

          <h2
            className="text-2xl font-bold text-haevn-navy mb-3"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 700 }}
          >
            Chat Coming Soon!
          </h2>

          <p
            className="text-haevn-charcoal/70 mb-6 leading-relaxed"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
          >
            We're building secure messaging features so you can connect with {partnership.display_name || 'your match'} safely.
          </p>

          <div className="bg-haevn-lightgray rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 text-left">
              <MessageCircle className="h-5 w-5 text-haevn-teal flex-shrink-0" />
              <p
                className="text-sm text-haevn-charcoal"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
              >
                In the meantime, you can view their profile and compatibility details from the connections page.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => router.push(`/connections/${connectionId}`)}
          >
            View Connection Details
          </Button>
        </div>
      </div>

      {/* Placeholder Input Area */}
      <div className="px-4 pb-6 pt-3 bg-white border-t border-haevn-gray-200 flex-shrink-0">
        <div className="bg-haevn-lightgray rounded-full py-3 px-5 flex items-center gap-3">
          <input
            type="text"
            placeholder="Message coming soon..."
            disabled
            className="flex-1 bg-transparent outline-none text-haevn-charcoal/50 placeholder:text-haevn-charcoal/30 cursor-not-allowed"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
          />
          <Button
            size="sm"
            disabled
            className="rounded-full bg-haevn-teal/50 hover:bg-haevn-teal/50 cursor-not-allowed"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
