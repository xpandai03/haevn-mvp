'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { checkCityStatus } from '@/lib/data/cities'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const { signUp, signIn } = useAuth()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    zipCode: ''
  })
  const [cityInfo, setCityInfo] = useState<{ name: string; status: 'live' | 'waitlist' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Check city status first
    const city = checkCityStatus(formData.zipCode)

    if (!city) {
      setError('Sorry, HAEVN is not available in your area yet.')
      setLoading(false)
      return
    }

    setCityInfo(city)

    try {
      // Create Supabase auth user with metadata
      const { data: signUpData, error: signUpError } = await signUp(
        formData.email,
        formData.password,
        {
          full_name: formData.name,
          city: city.name,
          zip_code: formData.zipCode,
          msa_status: city.status
        }
      )

      if (signUpError) {
        throw signUpError
      }

      // Store minimal data for onboarding flow
      localStorage.setItem('haevn_onboarding', JSON.stringify({
        city: city.name,
        cityStatus: city.status
      }))

      // Auto-login after signup
      const { error: signInError } = await signIn(formData.email, formData.password)

      if (signInError) {
        // If auto-login fails, still redirect to survey since account was created
        console.warn('Auto-login failed after signup:', signInError)
        toast({
          title: 'Account created!',
          description: 'Please sign in to continue.',
        })
        router.push('/auth/login')
      } else {
        // After successful login, ensure profile has city data
        // This is a workaround for the trigger not having access to metadata
        const { updateProfile } = await import('@/lib/actions/profile')
        await updateProfile({
          full_name: formData.name,
          city: city.name,
          msa_status: city.status
        })

        toast({
          title: 'Welcome to HAEVN!',
          description: 'Let\'s get started with your survey.',
        })

        // Always redirect to survey after successful signup and login
        // The survey page will handle city status checks
        router.push('/onboarding/survey')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Failed to create account')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to HAEVN</CardTitle>
          <CardDescription>Create your account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <div>
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                type="text"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                required
                pattern="[0-9]{5}"
                placeholder="00000"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign In
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}