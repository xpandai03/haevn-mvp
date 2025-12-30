'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { SurveyTab } from '@/components/settings/SurveyTab'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'
import { Loader2 } from 'lucide-react'

export default function SurveyResultsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HAEVNHeader />

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1
              className="text-xl font-bold text-haevn-navy"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
            >
              Survey Responses
            </h1>
            <p
              className="text-sm text-gray-500"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
            >
              Your answers that power your matches
            </p>
          </div>
        </div>

        {/* Survey Content */}
        <SurveyTab />
      </main>
    </div>
  )
}
