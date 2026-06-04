'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'

/**
 * Lemonsqueezy redirects here after a successful payment (productOptions.redirectUrl).
 * The tier flip happens server-side via the webhook; this page just confirms and
 * forwards the user into the app. We auto-redirect after a short countdown.
 */
export default function UpgradeSuccessPage() {
  const router = useRouter()
  const { refreshSession } = useAuth()
  const [countdown, setCountdown] = useState(5)

  // Refresh the session so the dashboard's server-side tier read reflects the
  // webhook's HAEVN+ flip (the webhook may land a beat after the redirect).
  useEffect(() => {
    refreshSession().catch(() => {})
  }, [refreshSession])

  const goToDashboard = () => {
    router.refresh()
    router.replace('/dashboard/matches')
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          goToDashboard()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-haevn-navy flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="font-heading text-3xl text-white mb-3">Welcome to HAEVN+</h1>
        <p className="text-white/60 text-lg mb-8">
          Your matches are now unlocked. Start connecting with your curated matches.
        </p>
        <p className="text-white/40 text-sm">
          Redirecting to your matches in {countdown}...
        </p>
        <button
          onClick={goToDashboard}
          className="mt-6 bg-haevn-orange text-white px-8 py-3 rounded-full font-medium hover:bg-haevn-orange/90 transition-colors"
        >
          View My Matches
        </button>
      </div>
    </div>
  )
}
