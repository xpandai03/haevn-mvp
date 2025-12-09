/**
 * Connection Detail Actions Component
 *
 * Message CTA button for connection detail page.
 */

'use client'

import { MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConnectionDetailActionsProps {
  onMessage: () => void
  loading?: boolean
}

export function ConnectionDetailActions({
  onMessage,
  loading = false,
}: ConnectionDetailActionsProps) {
  return (
    <div className="px-5 pb-6 pt-3 bg-white border-t border-haevn-gray-200 flex-shrink-0">
      <Button
        className="w-full h-12 text-base font-semibold bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full flex items-center justify-center gap-2"
        onClick={onMessage}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <MessageCircle className="h-5 w-5" />
            MESSAGE
          </>
        )}
      </Button>
    </div>
  )
}
