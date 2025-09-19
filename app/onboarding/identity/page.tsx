'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout'
import { useAuth } from '@/lib/auth/context'
import { getOnboardingFlowController } from '@/lib/onboarding/flow'
import { updateIdentitySimple } from '@/lib/actions/onboarding-simple'
import { User, Users, UsersRound } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const PROFILE_TYPES = [
  {
    id: 'solo',
    title: 'Solo Profile',
    description: 'Create a solo profile for yourself — joining as yourself, regardless of whether you have partners.',
    icon: User
  },
  {
    id: 'couple',
    title: 'With a Partner',
    description: 'Set up as a couple. You can link profiles, or one partner can participate without creating a profile.',
    icon: Users
  },
  {
    id: 'pod',
    title: 'Pod (3+)',
    description: 'Set up as a pod or polycule. Linked profiles are available but not required for every member.',
    icon: UsersRound
  }
]

const RELATIONSHIP_ORIENTATIONS = [
  { id: 'open_enm', label: 'Open / ENM' },
  { id: 'polyamorous', label: 'Polyamorous' },
  { id: 'monogamish', label: 'Monogamish' },
  { id: 'swinger', label: 'Swinger' },
  { id: 'curious', label: 'Curious / Learning' }
]

export default function IdentityPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const flowController = getOnboardingFlowController()
  const [profileType, setProfileType] = useState<string>('')
  const [orientations, setOrientations] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    }
  }, [user, router])

  const handleOrientationToggle = (orientationId: string) => {
    setOrientations(prev => {
      if (prev.includes(orientationId)) {
        return prev.filter(id => id !== orientationId)
      }
      return [...prev, orientationId]
    })
  }

  const handleContinue = async () => {
    if (!user || !profileType || orientations.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please select your profile type and at least one relationship orientation.',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      // Update identity fields using the simple action
      const { success, error } = await updateIdentitySimple(
        profileType as 'solo' | 'couple' | 'pod',
        orientations
      )

      // Even if there's an error, let user continue
      if (!success && error) {
        console.error('Identity update error (non-fatal):', error)
      }

      // Mark this step as complete in localStorage (backup)
      if (typeof window !== 'undefined') {
        localStorage.setItem('identity_completed', 'true')
      }

      // Always navigate to next step - don't block user progress
      router.push('/onboarding/survey-intro')
    } catch (error) {
      console.error('Error saving identity:', error)
      toast({
        title: 'Error',
        description: 'Failed to save your information. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout currentStep={4}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Who are you here on HAEVN?</CardTitle>
            <CardDescription>
              These are profile setup descriptors, not identity labels. Choose the option that best
              describes how you're arriving on HAEVN.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={profileType} onValueChange={setProfileType}>
              <div className="space-y-4">
                {PROFILE_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <label
                      key={type.id}
                      htmlFor={type.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        profileType === type.id
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <RadioGroupItem value={type.id} id={type.id} className="mt-1" />
                      <Icon className="h-5 w-5 text-primary mt-1" />
                      <div className="flex-1">
                        <div className="font-semibold">{type.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {type.description}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Relationship Orientation */}
        <Card>
          <CardHeader>
            <CardTitle>Relationship Orientation</CardTitle>
            <CardDescription>
              Select all that apply. This helps us make sure introductions align with your
              relationship style.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {RELATIONSHIP_ORIENTATIONS.map((orientation) => (
                <div key={orientation.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={orientation.id}
                    checked={orientations.includes(orientation.id)}
                    onCheckedChange={() => handleOrientationToggle(orientation.id)}
                  />
                  <Label
                    htmlFor={orientation.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {orientation.label}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleContinue}
            disabled={!profileType || orientations.length === 0 || saving}
            size="lg"
            className="min-w-[150px]"
          >
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}