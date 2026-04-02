'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HaevnLoader } from '@/components/ui/haevn-loader'

// Loading fallback
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <HaevnLoader size={80} />
    </div>
  )
}

// Redirect component with useSearchParams
function SignupRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Preserve invite code if present
    const inviteCode = searchParams.get('invite')
    const redirectUrl = inviteCode
      ? `/auth/signup/step-1?invite=${inviteCode}`
      : '/auth/signup/step-1'

    router.replace(redirectUrl)
  }, [router, searchParams])

  return <LoadingSpinner />
}

// Main page wrapped in Suspense boundary
export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SignupRedirect />
    </Suspense>
  )
}
