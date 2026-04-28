'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/update-password',
      })

      if (error) {
        console.error('[ResetPassword] Error:', error.message)
      }

      // Always show success message to avoid revealing whether email exists
      setSubmitted(true)
    } catch (err) {
      console.error('[ResetPassword] Unexpected error:', err)
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
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
                Reset your password
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
                {submitted
                  ? 'Check your email for a reset link'
                  : 'Enter your email and we\'ll send you a reset link'}
              </p>
            </div>

            {submitted ? (
              <div className="space-y-5">
                <Alert className="rounded-xl border-haevn-teal/30 bg-haevn-teal/5">
                  <CheckCircle2 className="h-4 w-4 text-haevn-teal" />
                  <AlertDescription
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 400,
                      fontSize: '14px'
                    }}
                  >
                    If an account exists with that email, we&apos;ve sent a password reset link. Please check your inbox.
                  </AlertDescription>
                </Alert>

                <div
                  className="text-center text-haevn-charcoal pt-4"
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
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
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
                  <Link href="/auth/login" className="text-haevn-teal hover:underline font-medium">
                    Back to sign in
                  </Link>
                </div>
              </form>
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
