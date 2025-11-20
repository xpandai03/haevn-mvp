'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Redirect to new 3-step signup flow
export default function SignupPage() {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
    </div>
  )
}
