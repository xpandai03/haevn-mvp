'use client'

import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Check } from 'lucide-react'

interface SectionCelebrationModalProps {
  isOpen: boolean
  onClose: () => void
  sectionTitle: string
  sectionNumber: number
  totalSections: number
  celebrationMessage: string
}

export function SectionCelebrationModal({
  isOpen,
  onClose,
  sectionTitle,
  sectionNumber,
  totalSections,
  celebrationMessage,
}: SectionCelebrationModalProps) {
  // Auto-dismiss so the flow stays moving; keep manual Continue as an escape.
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => onClose(), 2600)
    return () => clearTimeout(timer)
  }, [isOpen, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md sm:max-w-md bg-[color:var(--haevn-bg)] border border-[color:var(--haevn-border)] rounded-none p-0 shadow-none"
      >
        <div className="p-10 flex flex-col items-start gap-6">
          {/* Marker */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 flex items-center justify-center border border-[color:var(--haevn-teal)]">
              <Check
                className="w-4 h-4 text-[color:var(--haevn-teal)]"
                strokeWidth={2.5}
              />
            </span>
            <span className="text-xs tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
              Section {sectionNumber} of {totalSections}
            </span>
          </div>

          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-heading text-2xl sm:text-3xl font-medium text-[color:var(--haevn-navy)] leading-tight">
              {sectionTitle}
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-[color:var(--haevn-muted-fg)]">
              {celebrationMessage}
            </DialogDescription>
          </DialogHeader>

          {/* Section rail: filled so far */}
          <div className="w-full flex gap-1">
            {Array.from({ length: totalSections }).map((_, idx) => (
              <div
                key={idx}
                className="flex-1 h-[2px]"
                style={{
                  backgroundColor:
                    idx < sectionNumber
                      ? 'var(--haevn-teal)'
                      : 'var(--haevn-border)',
                }}
              />
            ))}
          </div>

          <button onClick={onClose} className="haevn-btn-primary self-start">
            Continue
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
