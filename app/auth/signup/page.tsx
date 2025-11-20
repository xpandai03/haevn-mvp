'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Loading fallback
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
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
