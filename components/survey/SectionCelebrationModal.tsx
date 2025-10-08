'use client'

import { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
  celebrationMessage
}: SectionCelebrationModalProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  // Update window size for confetti
  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Show confetti when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
      // Stop confetti after 3 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Auto-close after 3 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  return (
    <>
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Checkmark Icon */}
              <div className="w-16 h-16 rounded-full bg-haevn-teal/10 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-haevn-teal flex items-center justify-center animate-bounce">
                  <Check className="h-8 w-8 text-white" strokeWidth={3} />
                </div>
              </div>

              {/* Section Title */}
              <div className="text-center">
                <DialogTitle className="text-2xl text-haevn-charcoal mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                  Section Complete!
                </DialogTitle>
                <DialogDescription className="text-lg text-haevn-charcoal/70 mb-1" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  {sectionTitle}
                </DialogDescription>
              </div>

              {/* Celebration Message */}
              <div className="text-center px-4">
                <p className="text-xl text-haevn-charcoal" style={{ fontFamily: 'Roboto', fontWeight: 700 }}>
                  {celebrationMessage}
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center gap-2 bg-haevn-lightgray px-4 py-2 rounded-full">
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalSections }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full ${
                        idx < sectionNumber
                          ? 'bg-haevn-teal'
                          : 'bg-haevn-charcoal/20'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-haevn-charcoal/70 ml-2" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  {sectionNumber} of {totalSections} complete
                </p>
              </div>

              {/* Continue Button */}
              <Button
                onClick={onClose}
                className="mt-4 px-8 py-6 bg-haevn-teal hover:opacity-90 text-white rounded-full"
                style={{ fontFamily: 'Roboto', fontWeight: 500 }}
              >
                Continue
              </Button>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
