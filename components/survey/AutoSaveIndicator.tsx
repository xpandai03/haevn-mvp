'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'

interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
  error?: string
}

export function AutoSaveIndicator({ status, error }: AutoSaveIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true)
      if (status === 'saved') {
        const timer = setTimeout(() => setVisible(false), 2000)
        return () => clearTimeout(timer)
      }
    } else {
      setVisible(false)
    }
  }, [status])

  if (!visible) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <X className="h-4 w-4 text-destructive" />
          <span className="text-destructive">
            {error || 'Failed to save'}
          </span>
        </>
      )}
    </div>
  )
}