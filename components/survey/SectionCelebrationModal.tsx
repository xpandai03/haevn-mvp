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
      // Ensure confetti shows by setting with slight delay
      setTimeout(() => setShowConfetti(true), 100)
      // Stop confetti after 5 seconds (increased duration)
      const timer = setTimeout(() => {
        setShowConfetti(false)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setShowConfetti(false)
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
      {showConfetti && windowSize.width > 0 && windowSize.height > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.25}
          colors={['#E29E0C', '#008080', '#E8E6E3', '#252627']}
        />
      )}

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Large Section Number with Flame - Duolingo Style */}
              <div className="relative mb-6">
                <div className="w-32 h-32 mx-auto relative">
                  {/* Flame/Fire Effect */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#E29E0C] via-[#D88A0A] to-[#C77A09] animate-pulse"></div>
                  </div>
                  {/* Section Number */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl font-black text-white drop-shadow-lg" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                      {sectionNumber}
                    </span>
                  </div>
                  {/* Checkmark badge */}
                  <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-haevn-teal flex items-center justify-center border-4 border-white shadow-lg">
                    <Check className="h-6 w-6 text-white" strokeWidth={3} />
                  </div>
                </div>
              </div>

              {/* Section Title */}
              <div className="text-center">
                <DialogTitle className="text-xl sm:text-2xl text-haevn-charcoal mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                  Section Complete!
                </DialogTitle>
                <DialogDescription className="text-base sm:text-lg text-haevn-charcoal/70 mb-1" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  {sectionTitle}
                </DialogDescription>
              </div>

              {/* Celebration Message */}
              <div className="text-center px-4">
                <p className="text-lg sm:text-xl text-haevn-charcoal" style={{ fontFamily: 'Roboto', fontWeight: 700 }}>
                  {celebrationMessage}
                </p>
              </div>

              {/* Progress Bar - Duolingo Style */}
              <div className="w-full px-4">
                <div className="flex items-center justify-center gap-1 mb-3">
                  {Array.from({ length: totalSections }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex-1 relative"
                    >
                      {/* Bar segment */}
                      <div className={`h-3 rounded-full transition-all duration-300 ${
                        idx < sectionNumber
                          ? 'bg-gradient-to-r from-[#E29E0C] to-[#D88A0A]'
                          : idx === sectionNumber - 1
                          ? 'bg-haevn-teal ring-2 ring-haevn-teal ring-offset-2'
                          : 'bg-haevn-charcoal/10'
                      }`}></div>

                      {/* Checkmark for completed */}
                      {idx < sectionNumber && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                          <Check className="h-4 w-4 text-[#E29E0C]" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-haevn-charcoal/70 text-center" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  {sectionNumber} of {totalSections} sections complete
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
