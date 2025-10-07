'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { SurveyTab } from '@/components/settings/SurveyTab'

export default function SurveyResultsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 text-[#252627] hover:text-[#008080]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
          <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Survey Responses
          </h1>
          <p className="text-body text-[#252627]/80" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Review and update your survey answers
          </p>
        </div>

        {/* Survey Content */}
        <SurveyTab />
      </div>
    </div>
  )
}
