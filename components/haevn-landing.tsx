'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function HaevnLanding() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-haevn-lightgray">
      <div className="w-full max-w-2xl mx-auto">
        {/* Logo/Brand */}
        <div className="mb-12 text-left">
          <h1
            className="text-haevn-navy mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '48px',
              lineHeight: '100%',
              letterSpacing: '-0.015em',
              textAlign: 'left'
            }}
          >
            Welcome to HAEVN
          </h1>
          <p
            className="text-haevn-charcoal mb-6"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '18px',
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            A private, intentional space for couples and groups exploring ethical non-monogamy.
          </p>
          <p
            className="text-haevn-charcoal"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '16px',
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            No endless swiping. Just thoughtful introductions based on compatibility, values, and what you're actually looking for.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push('/auth/signup')}
            className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
            size="lg"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '18px'
            }}
          >
            Get started
          </Button>
          <Button
            onClick={() => router.push('/auth/login')}
            className="w-full bg-white hover:bg-haevn-lightgray text-haevn-navy border-2 border-haevn-navy rounded-full"
            size="lg"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 500,
              fontSize: '18px'
            }}
          >
            Sign in
          </Button>
        </div>

        {/* Footer note */}
        <div className="mt-12">
          <p
            className="text-haevn-charcoal opacity-70"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              fontSize: '14px',
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            Available in select cities. You'll enter your ZIP code during signup to check availability.
          </p>
        </div>
      </div>
    </div>
  )
}