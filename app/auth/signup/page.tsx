'use client'

import { Suspense } from 'react'
import SignupForm from './SignupForm'
import { Loader2 } from 'lucide-react'

// Loading fallback component
function SignupLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-haevn-lightgray">
      <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
    </div>
  )
}

// Main page component wrapped in Suspense
export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupForm />
    </Suspense>
  )
}
