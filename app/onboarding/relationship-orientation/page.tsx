'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'

type RelationshipOrientation = 'monogamous' | 'open' | 'polyamorous' | 'exploring' | 'other'

export default function RelationshipOrientationPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const [selectedOrientation, setSelectedOrientation] = useState<RelationshipOrientation | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  const handleContinue = async () => {
    if (!user || !selectedOrientation) return

    setIsSubmitting(true)
    console.log('[RelationshipOrientation] Submitting:', { relationshipOrientation: selectedOrientation })

    try {
      // Call API endpoint to save relationship orientation
      console.log('[RelationshipOrientation] Calling /api/onboarding/save-identity')
      const response = await fetch('/api/onboarding/save-identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          relationshipOrientation: selectedOrientation
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('[RelationshipOrientation] API error:', data.error)
        throw new Error(data.error || 'Failed to save relationship orientation')
      }

      console.log('[RelationshipOrientation] ✅ Saved successfully')

      // Navigate to verification
      router.push('/onboarding/verification')
    } catch (error) {
      console.error('[RelationshipOrientation] Error saving orientation:', error)
      toast({
        title: 'Error',
        description: 'Failed to save your selection. Please try again.',
        variant: 'destructive'
      })
      setIsSubmitting(false)
    }
  }

  const orientations = [
    {
      id: 'monogamous' as RelationshipOrientation,
      title: 'Monogamous',
      description: 'Exclusive emotional and physical connection'
    },
    {
      id: 'open' as RelationshipOrientation,
      title: 'Open',
      description: 'Primary partnership with consensual outside connections'
    },
    {
      id: 'polyamorous' as RelationshipOrientation,
      title: 'Polyamorous',
      description: 'Multiple loving relationships'
    },
    {
      id: 'exploring' as RelationshipOrientation,
      title: 'Exploring',
      description: 'Still figuring out what works for me'
    },
    {
      id: 'other' as RelationshipOrientation,
      title: 'Other / Prefer to describe',
      description: "I'll share more in my survey"
    }
  ]

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Main content - centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg space-y-8">
          {/* Heading */}
          <div className="space-y-3">
            <h1
              className="text-haevn-navy"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 700,
                fontSize: '28px',
                lineHeight: '120%',
                letterSpacing: '-0.015em'
              }}
            >
              What is your relationship orientation?
            </h1>
            <p
              className="text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '140%'
              }}
            >
              Tell us what type of relationship dynamic feels most natural or comfortable for you right now.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {orientations.map((orientation) => {
              const isSelected = selectedOrientation === orientation.id

              return (
                <button
                  key={orientation.id}
                  onClick={() => setSelectedOrientation(orientation.id)}
                  className={`w-full p-4 rounded-2xl transition-all text-left ${
                    isSelected
                      ? 'bg-white border-2 border-haevn-teal ring-2 ring-haevn-teal/20'
                      : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-6 h-6 rounded-full border-2 ${
                          isSelected
                            ? 'border-haevn-teal bg-white'
                            : 'border-gray-400 bg-white'
                        } flex items-center justify-center`}
                      >
                        {isSelected && (
                          <div className="w-3 h-3 rounded-full bg-haevn-teal" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3
                        className="text-haevn-navy mb-1"
                        style={{
                          fontFamily: 'Roboto, Helvetica, sans-serif',
                          fontWeight: 600,
                          fontSize: '18px',
                          lineHeight: '120%'
                        }}
                      >
                        {orientation.title}
                      </h3>
                      <p
                        className="text-haevn-charcoal"
                        style={{
                          fontFamily: 'Roboto, Helvetica, sans-serif',
                          fontWeight: 400,
                          fontSize: '14px',
                          lineHeight: '140%'
                        }}
                      >
                        {orientation.description}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </main>

      {/* Bottom-fixed CTA */}
      <footer className="pb-8 px-6">
        <Button
          onClick={handleContinue}
          disabled={!selectedOrientation || isSubmitting}
          className="w-full max-w-md mx-auto block bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full h-14 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
            fontSize: '18px'
          }}
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </Button>
      </footer>
    </div>
  )
}
