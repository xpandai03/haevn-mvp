'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { ReadyToMeetUiState } from '@/lib/types/readyToMeet'

interface ReadyToMeetButtonProps {
  otherPartnershipId: string
  initialState: ReadyToMeetUiState
}

export function ReadyToMeetButton({
  otherPartnershipId,
  initialState,
}: ReadyToMeetButtonProps) {
  const [state, setState] = useState<ReadyToMeetUiState>(initialState)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setState(initialState)
  }, [initialState, otherPartnershipId])

  if (state === 'mutual') {
    return (
      <div
        className="flex w-full items-center gap-2 rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800"
        role="status"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 keep-rounded"
          aria-hidden
        />
        Ready to Meet!
      </div>
    )
  }

  if (state === 'viewer_ready') {
    return (
      <div
        className="flex items-center gap-1.5 text-sm text-[color:var(--haevn-teal)]"
        role="status"
      >
        <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
        You&apos;re ready to meet
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async (e) => {
        e.stopPropagation()
        setLoading(true)
        try {
          const res = await fetch('/api/matches/ready-to-meet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otherPartnershipId }),
          })
          const data = (await res.json()) as {
            success?: boolean
            state?: ReadyToMeetUiState
            error?: string
          }
          if (data.success && data.state) {
            setState(data.state)
          }
        } finally {
          setLoading(false)
        }
      }}
      className="w-full rounded-[var(--radius)] border border-[color:var(--haevn-border)] bg-[color:var(--haevn-dash-surface-alt)] px-3 py-2.5 text-left text-sm font-medium text-[color:var(--haevn-charcoal)] transition-colors hover:bg-[color:var(--haevn-warm-gray)] disabled:opacity-60"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving…
        </span>
      ) : (
        'Ready to Meet'
      )}
    </button>
  )
}
