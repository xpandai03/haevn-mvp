'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, ArrowRight } from 'lucide-react'

interface CompleteProfileCTAProps {
  onAddPhotosClick: () => void
}

export function CompleteProfileCTA({ onAddPhotosClick }: CompleteProfileCTAProps) {
  return (
    <Card className="rounded-3xl border-haevn-teal/30 bg-haevn-teal/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-haevn-navy flex items-center gap-2 text-base">
          <Camera className="h-5 w-5 text-haevn-teal" />
          Complete Your Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className="text-haevn-charcoal opacity-70 mb-4"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 300,
            fontSize: '13px',
            lineHeight: '140%'
          }}
        >
          Add a profile photo to complete your profile and start connecting.
        </p>
        <Button
          onClick={onAddPhotosClick}
          className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full"
          size="lg"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500,
            fontSize: '16px'
          }}
        >
          Add Photos
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
