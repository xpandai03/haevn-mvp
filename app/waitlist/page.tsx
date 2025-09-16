'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function WaitlistPage() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    const userData = localStorage.getItem('haevn_user')
    if (userData) {
      setUserInfo(JSON.parse(userData))
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You're on the waitlist!</CardTitle>
          <CardDescription>
            HAEVN is coming soon to {userInfo?.city || 'your city'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We're excited to launch in your area soon. You'll be among the first to know when HAEVN becomes available in {userInfo?.city || 'your city'}.
          </p>

          <div className="bg-secondary p-4 rounded-lg">
            <p className="text-sm font-medium">Complete your profile now</p>
            <p className="text-xs text-muted-foreground mt-1">
              Get ahead by completing your survey. When we launch in your city, you'll be ready to start connecting immediately.
            </p>
          </div>

          <Button
            onClick={() => router.push('/onboarding/survey')}
            className="w-full"
          >
            Complete Survey Now
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}