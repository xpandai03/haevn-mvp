'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log('[Login] Starting login for:', email)

    try {
      console.log('[Login] Calling signIn...')
      const { data: signInData, error: signInError } = await signIn(email, password)

      if (signInError) {
        console.error('[Login] SignIn error:', signInError)
        throw signInError
      }

      console.log('[Login] ✅ SignIn successful!')
      console.log('[Login] User ID:', signInData?.session?.user?.id)
      console.log('[Login] User email:', signInData?.session?.user?.email)

      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in to your account.',
      })

      // PHASE 3: Use API route instead of client-side getResumeStep()
      // This prevents 400 errors from direct Supabase queries in browser
      console.log('[Login] ===== GETTING RESUME PATH FROM API =====')
      console.log('[Login] User ID:', signInData.session.user.id)

      try {
        // Fetch resume path from server-side API route
        const response = await fetch('/api/onboarding/resume-step', {
          method: 'GET',
          credentials: 'include', // Include cookies for auth
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          console.error('[Login] API route returned error:', response.status)
          // Fallback to dashboard if API fails
          window.location.href = '/dashboard'
          return
        }

        const data = await response.json()
        console.log('[Login] ===== RESUME PATH DETERMINED =====')
        console.log('[Login] Resume path returned:', data.resumePath)
        console.log('[Login] Redirecting to:', data.resumePath)
        console.log('[Login] =====================================')

        // Use window.location for reliable redirect
        window.location.href = data.resumePath
      } catch (fetchError) {
        console.error('[Login] Failed to fetch resume path:', fetchError)
        // Fallback to dashboard
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      console.error('[Login] ❌ Login error:', err)
      console.error('[Login] Error details:', err)
      setError(err.message || 'Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Images */}
      <div className="absolute inset-0 z-0">
        {/* Mobile */}
        <Image
          src="/images/hero-mobile.png"
          alt=""
          fill
          className="object-cover md:hidden"
          priority
        />
        {/* Desktop */}
        <Image
          src="/images/hero-desktop.png"
          alt=""
          fill
          className="hidden md:block object-cover"
          priority
        />
        {/* Dark overlay for better text contrast */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Logo at top */}
        <div className="flex justify-center pt-8 md:pt-12">
          <Image
            src="/images/haevn-logo-icon-white.png"
            alt="HAEVN"
            width={80}
            height={80}
            className="object-contain"
          />
        </div>

        {/* Centered Form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-lg">
            <div className="text-center mb-6">
              <h1
                className="text-haevn-navy mb-2"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 700,
                  fontSize: '28px',
                  lineHeight: '100%',
                  letterSpacing: '-0.015em'
                }}
              >
                Welcome back
              </h1>
              <p
                className="text-haevn-charcoal"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '16px',
                  lineHeight: '120%'
                }}
              >
                Sign in to your HAEVN account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label
                htmlFor="email"
                className="text-haevn-navy mb-2 block"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="border-haevn-navy rounded-xl"
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="text-haevn-navy mb-2 block"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  textAlign: 'left'
                }}
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="border-haevn-navy rounded-xl"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full mt-6"
              size="lg"
              disabled={loading}
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '18px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>

            <div
              className="text-center text-haevn-charcoal pt-4"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300,
                fontSize: '14px'
              }}
            >
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-haevn-teal hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </form>
          </div>
        </div>

        {/* Footer with legal links */}
        <footer className="pb-6 text-center">
          <div className="flex justify-center gap-6 text-sm">
            <a
              href="https://haevn.co/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-white transition-colors"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300
              }}
            >
              Terms of Service
            </a>
            <a
              href="https://haevn.co/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-white transition-colors"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300
              }}
            >
              Privacy Policy
            </a>
            <a
              href="https://haevn.co/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-white transition-colors"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300
              }}
            >
              Cookies Policy
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}