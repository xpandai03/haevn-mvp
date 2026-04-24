'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getClientOnboardingFlowController } from '@/lib/onboarding/client-flow'
import { useToast } from '@/hooks/use-toast'

export default function CelebrationPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const flowController = getClientOnboardingFlowController()

  useEffect(() => {
    if (loading) return
    if (!user) router.push('/auth/login')
  }, [user, loading, router])

  const handleContinue = async () => {
    if (!user) return
    try {
      await flowController.markStepComplete(user.id, 8)
      router.push('/onboarding/membership')
    } catch (error) {
      console.error('Error updating onboarding state:', error)
      toast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div
      className="survey-layout min-h-screen bg-[color:var(--haevn-bg)] text-[color:var(--haevn-charcoal)]"
      data-testid="celebration-page"
    >
      <div className="max-w-2xl mx-auto px-6 sm:px-12 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-10"
        >
          {/* Marker */}
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 flex items-center justify-center border border-[color:var(--haevn-teal)]">
              <Check
                className="w-5 h-5 text-[color:var(--haevn-teal)]"
                strokeWidth={2.5}
              />
            </span>
            <span className="text-xs tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
              Survey complete
            </span>
          </div>

          {/* Hero */}
          <div className="space-y-4">
            <h1 className="font-heading text-4xl sm:text-5xl font-medium text-[color:var(--haevn-navy)] leading-tight">
              You&rsquo;re in.
            </h1>
            <p className="text-base sm:text-lg text-[color:var(--haevn-muted-fg)] leading-relaxed max-w-xl">
              Your survey has been saved. We&rsquo;ll use your responses to
              prepare your matches and shape your experience inside HAEVN.
            </p>
          </div>

          {/* What happens next — architectural, no card */}
          <div className="space-y-5 pt-4 border-t border-[color:var(--haevn-border)]">
            <p className="text-xs tracking-[0.22em] uppercase text-[color:var(--haevn-muted-fg)]">
              What happens next
            </p>
            <ol className="space-y-4 text-base leading-relaxed text-[color:var(--haevn-charcoal)]">
              <li className="flex items-start gap-4">
                <span className="font-heading text-sm tracking-wider text-[color:var(--haevn-teal)] w-8 shrink-0 mt-0.5">
                  01
                </span>
                <span>
                  We review your responses to find people who share your values
                  and relationship style.
                </span>
              </li>
              <li className="flex items-start gap-4">
                <span className="font-heading text-sm tracking-wider text-[color:var(--haevn-teal)] w-8 shrink-0 mt-0.5">
                  02
                </span>
                <span>
                  You&rsquo;ll explore your dashboard, refine your profile, and
                  see potential matches as we activate your market.
                </span>
              </li>
              <li className="flex items-start gap-4">
                <span className="font-heading text-sm tracking-wider text-[color:var(--haevn-teal)] w-8 shrink-0 mt-0.5">
                  03
                </span>
                <span>
                  Choose a membership plan to unlock messaging and connect with
                  others.
                </span>
              </li>
            </ol>
          </div>

          {/* CTA */}
          <div className="pt-6">
            <button
              onClick={handleContinue}
              className="haevn-btn-primary"
              data-testid="celebration-continue"
            >
              Choose your membership →
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
