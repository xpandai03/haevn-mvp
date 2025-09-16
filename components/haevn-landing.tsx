'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function HaevnLanding() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-6xl font-bold mb-4">
          Welcome to <span className="text-orange-500">HAEVN</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          A dating app built for connection. Not just matches.
        </p>
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
          Especially if you&apos;re ENM, bisexual, or don&apos;t fit the traditional mold.
          Complete our deep survey to find meaningful connections.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => router.push('/auth/signup')}
          >
            Join Waitlist
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push('/auth/signup')}
          >
            Sign In
          </Button>
        </div>
        <div className="mt-16 text-sm text-muted-foreground">
          <p>Click any button to start the signup flow</p>
          <p>You&apos;ll be asked for your ZIP code to check city availability</p>
        </div>
      </div>
    </div>
  )
}