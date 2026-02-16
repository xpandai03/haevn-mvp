'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true)
        setChecking(false)
      }
    })

    // Fallback: check if there's already an active session (token may have been exchanged before listener was set up)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setRecoveryReady(true)
      }
      setChecking(false)
    }

    // Give the auth state change listener a moment to fire, then fall back to session check
    const timeout = setTimeout(checkSession, 1500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        throw updateError
      }

      toast({
        title: 'Password updated',
        description: 'Your password has been updated successfully.',
      })

      router.push('/auth/login')
    } catch (err: any) {
      console.error('[UpdatePassword] Error:', err)
      setError(err.message || 'Failed to update password. Please try again.')
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
            {checking ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
              </div>
            ) : !recoveryReady ? (
              <div className="text-center space-y-4">
                <div className="mb-6">
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
                    Link expired
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
                    This password reset link is invalid or has expired.
                  </p>
                </div>

                <Link
                  href="/auth/reset-password"
                  className="inline-block"
                >
                  <Button
                    className="bg-haevn-teal hover:opacity-90 text-white rounded-full"
                    size="lg"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500,
                      fontSize: '18px'
                    }}
                  >
                    Request a new link
                  </Button>
                </Link>

                <div
                  className="text-haevn-charcoal pt-2"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 300,
                    fontSize: '14px'
                  }}
                >
                  <Link href="/auth/login" className="text-haevn-teal hover:underline font-medium">
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <>
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
                    Set new password
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
                    Enter your new password below
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
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
                      New password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="border-haevn-navy rounded-xl"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="confirmPassword"
                      className="text-haevn-navy mb-2 block"
                      style={{
                        fontFamily: 'Roboto, Helvetica, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        textAlign: 'left'
                      }}
                    >
                      Confirm password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Re-enter your password"
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
                        Updating...
                      </>
                    ) : (
                      'Update password'
                    )}
                  </Button>
                </form>
              </>
            )}
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
