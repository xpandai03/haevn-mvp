'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface GenerateSummaryButtonProps {
  partnershipId: string
  /** "primary" (gold CTA) or "subtle" (small text-link, e.g. for regenerate) */
  variant?: 'primary' | 'subtle'
  /** Override button label (defaults: Generate my summary / Regenerate). */
  label?: string
}

/**
 * Triggers the existing /api/ai/generate-summaries endpoint for the
 * user's active partnership. On success, refreshes the route so the
 * freshly-written partnerships.haevn_insight field rehydrates into the
 * server component.
 */
export function GenerateSummaryButton({
  partnershipId,
  variant = 'primary',
  label,
}: GenerateSummaryButtonProps) {
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
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean
        message?: string
        error?: string
      }

      // 503 → AI unavailable (quota exceeded, network, missing key).
      // The route does NOT write a fallback to the DB any more, so the
      // user can simply try again later. Surface the API's message.
      if (!res.ok || !payload.success) {
        const friendly =
          payload.message ||
          (res.status === 503
            ? 'AI service is temporarily unavailable. Please try again later.'
            : `Couldn't generate summary (${res.status}).`)
        toast({
          title: "Couldn't generate summary",
          description: friendly,
          variant: 'destructive',
        })
        return
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
            : 'Network error. Check your connection and try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const defaultLabel =
    variant === 'subtle' ? 'Regenerate' : 'Generate my summary'
  const text = isGenerating
    ? variant === 'subtle'
      ? 'Regenerating…'
      : 'Generating…'
    : label || defaultLabel

  if (variant === 'subtle') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isGenerating}
        className="inline-flex items-center gap-1.5 text-xs text-[color:var(--haevn-teal)] hover:opacity-80 disabled:opacity-50 transition-opacity"
        data-testid="regenerate-summary-btn"
      >
        {isGenerating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" strokeWidth={1.75} />
        )}
        {text}
      </button>
    )
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
      {text}
    </button>
  )
}
