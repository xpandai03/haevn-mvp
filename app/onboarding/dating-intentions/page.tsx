'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { Coffee, MessageCircle, Heart } from 'lucide-react'

type DatingIntention = 'here_to_date' | 'open_to_chat' | 'ready_for_relationship'

export default function DatingIntentionsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [selectedIntention, setSelectedIntention] = useState<DatingIntention | null>(null)

  // Get user's first name for personalization
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  const handleContinue = () => {
    if (!selectedIntention) return

    // Store selection in localStorage for now
    localStorage.setItem('haevn_dating_intention', selectedIntention)

    // Navigate to identity page (solo/couple/pod selection)
    router.push('/onboarding/identity')
  }

  const intentions = [
    {
      id: 'here_to_date' as DatingIntention,
      icon: Coffee,
      title: 'Here to date',
      description: 'I want to go on dates and have a good time. No labels.'
    },
    {
      id: 'open_to_chat' as DatingIntention,
      icon: MessageCircle,
      title: 'Open to chat',
      description: "I'm here to chat and see where it goes. No pressure."
    },
    {
      id: 'ready_for_relationship' as DatingIntention,
      icon: Heart,
      title: 'Ready for a relationship',
      description: "I'm looking for something that lasts. No games."
    }
  ]

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Main content - centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md space-y-6">
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
              Come on in, {firstName}! Tell people why you're here.
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
              Be confident about what you want, and find the right people for you. You can change this anytime.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {intentions.map((intention) => {
              const Icon = intention.icon
              const isSelected = selectedIntention === intention.id

              return (
                <button
                  key={intention.id}
                  onClick={() => setSelectedIntention(intention.id)}
                  className={`w-full p-4 rounded-2xl transition-all ${
                    isSelected
                      ? 'bg-haevn-lightgray border-2 border-haevn-teal'
                      : 'bg-haevn-lightgray border-2 border-transparent hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <Icon className="w-8 h-8 text-haevn-navy" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3
                        className="text-haevn-navy mb-1"
                        style={{
                          fontFamily: 'Roboto, Helvetica, sans-serif',
                          fontWeight: 600,
                          fontSize: '18px',
                          lineHeight: '120%'
                        }}
                      >
                        {intention.title}
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
                        {intention.description}
                      </p>
                    </div>
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
          disabled={!selectedIntention}
          className="w-full max-w-md mx-auto block bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full h-14 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
            fontSize: '18px'
          }}
        >
          Continue
        </Button>
      </footer>
    </div>
  )
}
