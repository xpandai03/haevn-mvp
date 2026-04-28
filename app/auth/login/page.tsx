'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { safeResponseJson } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (oauthError) {
        console.error('[Login] Google OAuth error:', oauthError)
        setError('Google sign-in is not available yet. Please use email and password.')
        setGoogleLoading(false)
      }
    } catch {
      setError('Google sign-in is not available yet. Please use email and password.')
      setGoogleLoading(false)
    }
  }

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

        const { data, parseError } = await safeResponseJson(response)
        if (parseError || !data) {
          console.error('[Login] Failed to parse resume-step response:', parseError)
          window.location.href = '/dashboard'
          return
        }
        console.log('[Login] ===== RESUME PATH DETERMINED =====')
        console.log('[Login] Status:', data.status)
        console.log('[Login] Resume path returned:', data.resumePath)
        console.log('[Login] =====================================')

        // CRITICAL: Check status BEFORE redirecting
        if (data.status === 'complete') {
          // Onboarding is complete - go to dashboard
          console.log('[Login] ✅ Onboarding COMPLETE - going to dashboard')
          window.location.href = '/dashboard'
        } else if (data.status === 'incomplete' && data.resumePath) {
          // Onboarding incomplete - resume where they left off
          console.log('[Login] Onboarding incomplete - resuming at:', data.resumePath)
          window.location.href = data.resumePath
        } else {
          // Fallback - should not happen but be safe
          console.log('[Login] Unknown status, falling back to dashboard')
          window.location.href = '/dashboard'
        }
      } catch (fetchError) {
        console.error('[Login] Failed to fetch resume path:', fetchError)
        // Fallback to dashboard
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      console.error('[Login] ❌ Login error:', err)
      console.error('[Login] Error details:', err)
      const msg = err?.message || ''
      const isTechnical = msg.includes('Unexpected end of JSON') || msg.includes('SyntaxError') || msg.includes('Failed to fetch')
      setError(isTechnical ? 'Login failed. Please check your credentials and try again.' : (msg || 'Invalid email or password'))
      setLoading(false)
    }
  }

  return (
    <div className="survey-layout relative min-h-screen w-full overflow-hidden">
      {/* Hero Background Images */}
      <div className="absolute inset-0 z-0">
        {/* Mobile */}
        <Image
          src="/login-bg-mobile.png"
          alt=""
          fill
          className="object-cover md:hidden"
          priority
        />
        {/* Desktop */}
        <Image
          src="/login-bg-desktop.png"
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
          <div className="relative w-[220px] md:w-[280px] h-[55px] md:h-[70px]">
            <Image
              src="/images/haevn-logo-icon-white.png"
              alt="HAEVN"
              fill
              priority
              className="object-contain"
            />
          </div>
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
              <div className="mt-2 text-right">
                <Link
                  href="/auth/reset-password"
                  className="text-haevn-teal hover:underline font-medium"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 400,
                    fontSize: '13px'
                  }}
                >
                  Forgot password?
                </Link>
              </div>
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
                  <HaevnLoader size={18} className="mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>

            {/* Divider */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span
                  className="bg-white px-3 text-haevn-charcoal"
                  style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300, fontSize: '12px' }}
                >
                  or
                </span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full border-gray-300"
              size="lg"
              disabled={googleLoading || loading}
              onClick={handleGoogleSignIn}
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
              }}
            >
              {googleLoading ? (
                <>
                  <HaevnLoader size={18} className="mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </>
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