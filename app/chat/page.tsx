'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('haevn_user')

    if (!userData) {
      router.push('/auth/signup')
      return
    }

    const parsed = JSON.parse(userData)

    // Enforce gating rules
    if (!parsed.surveyCompleted) {
      alert('You must complete your survey before accessing chat')
      router.push('/onboarding/survey')
      return
    }

    if (parsed.membershipTier === 'free') {
      alert('Upgrade to HAEVN+ to access chat')
      router.push('/onboarding/membership')
      return
    }

    setUser(parsed)
  }, [router])

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-muted-foreground">Chat with your matches</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No handshakes yet</CardTitle>
            <CardDescription>
              You need to match with someone (mutual like) before you can start chatting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/discovery')}>
              Go to Discovery
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}