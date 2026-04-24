'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface GenerateSummaryButtonProps {
  partnershipId: string
}

/**
 * Triggers the existing /api/ai/generate-summaries endpoint for the
 * user's active partnership. On success, refreshes the route so the
 * freshly-written partnerships.haevn_insight field rehydrates into the
 * server component.
 */
export function GenerateSummaryButton({ partnershipId }: GenerateSummaryButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleClick = async () => {
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ partnershipId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `Request failed (${res.status})`)
      }
      toast({
        title: 'Summary ready',
        description: "We've written your profile summary — refreshing…",
      })
      router.refresh()
    } catch (err) {
      console.error('[GenerateSummaryButton] Failed:', err)
      toast({
        title: "Couldn't generate summary",
        description:
          err instanceof Error
            ? err.message
            : 'Please try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isGenerating}
      className="haevn-btn-gold inline-flex items-center gap-2 text-sm mt-3"
      data-testid="generate-summary-btn"
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" strokeWidth={1.75} />
      )}
      {isGenerating ? 'Generating…' : 'Generate my summary'}
    </button>
  )
}
