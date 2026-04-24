'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function MessagesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const partner = searchParams.get('partner')

  return (
    <div className="w-full">
      {/* Header */}
      <header className="px-6 sm:px-10 pt-10 pb-6 border-b border-[color:var(--haevn-border)]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
            Conversations
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] mt-2 leading-tight">
            Messages
          </h1>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-4xl mx-auto px-6 sm:px-10 py-16 sm:py-24">
        <div className="max-w-lg">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-muted-fg)]">
            Coming soon
          </p>
          <h2 className="font-heading text-3xl text-[color:var(--haevn-navy)] mt-3 leading-tight">
            Messaging is on the way.
          </h2>
          <p className="text-base text-[color:var(--haevn-muted-fg)] leading-relaxed mt-4">
            Full messaging will live here. For now, view your connections from
            the dashboard — when you connect with someone, a thread will appear
            in this view.
          </p>

          {partner && (
            <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-4">
              Ready to message partnership: {partner}
            </p>
          )}

          <div className="flex flex-wrap gap-3 mt-10">
            <button
              type="button"
              onClick={() => router.push('/dashboard/connections')}
              className="haevn-btn-primary"
            >
              View connections
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="haevn-btn-secondary"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--haevn-teal)]" />
        </div>
      }
    >
      <MessagesPageInner />
    </Suspense>
  )
}
