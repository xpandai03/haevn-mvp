'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const partner = searchParams.get('partner')

  return (
    <div className="min-h-screen bg-haevn-lightgray">
      {/* Header */}
      <header className="bg-white border-b border-haevn-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="text-haevn-charcoal hover:text-haevn-teal"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
          <h1
            className="text-2xl font-bold text-haevn-navy"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              letterSpacing: '-0.015em'
            }}
          >
            Messages
          </h1>
          <div className="w-24" /> {/* Spacer for centered title */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <h2
            className="text-2xl font-bold text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700
            }}
          >
            Messages Coming Soon
          </h2>
          <p
            className="text-haevn-charcoal mb-6"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              lineHeight: '120%'
            }}
          >
            Full messaging functionality will be available soon. For now, you can view your connections from the dashboard.
          </p>
          {partner && (
            <p className="text-sm text-haevn-charcoal/60 mb-6">
              Ready to message partnership: {partner}
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => router.push('/dashboard/connections')}
              className="bg-haevn-teal hover:opacity-90 text-white"
            >
              View Connections
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="text-haevn-charcoal"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}