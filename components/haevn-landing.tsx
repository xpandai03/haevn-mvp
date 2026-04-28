'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function HaevnLanding() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Images - Responsive */}
      <div className="absolute inset-0 z-0">
        {/* Mobile Hero Image */}
        <Image
          src="/login-bg-mobile.png"
          alt="HAEVN Hero Background"
          fill
          priority
          className="object-cover md:hidden"
          quality={90}
        />
        {/* Desktop Hero Image */}
        <Image
          src="/login-bg-desktop.png"
          alt="HAEVN Hero Background"
          fill
          priority
          className="object-cover hidden md:block"
          quality={90}
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Centered: Logo + Tagline + CTAs */}
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            {/* Logo */}
            <div className="relative w-[220px] md:w-[280px] h-[55px] md:h-[70px] mb-4">
              <Image
                src="/images/haevn-logo-icon-white.png"
                alt="HAEVN"
                fill
                priority
                className="object-contain"
              />
            </div>

            {/* Tagline */}
            <p
              className="text-white mb-12"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300,
                fontSize: '20px',
                lineHeight: '130%',
                letterSpacing: '-0.01em',
              }}
            >
              Find Your People
            </p>

            {/* CTA Buttons */}
            <div className="space-y-3 w-full">
              <Button
                onClick={() => router.push('/auth/signup')}
                className="w-full bg-haevn-orange hover:bg-haevn-orange/90 text-white rounded-full h-14 text-lg font-medium transition-all"
                size="lg"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px',
                }}
              >
                Get Started
              </Button>
              <Button
                onClick={() => router.push('/auth/login')}
                variant="outline"
                className="w-full bg-transparent hover:bg-white/10 text-white border-2 border-white rounded-full h-14 text-lg font-medium transition-all"
                size="lg"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px',
                }}
              >
                Sign In
              </Button>
            </div>
          </div>
        </main>

        {/* Footer pinned to bottom */}
        <footer className="px-6 pb-6 md:pb-8">
          <div className="w-full max-w-md mx-auto space-y-3 text-center">
            {/* Disclaimer */}
            <p
              className="text-white/90"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300,
                fontSize: '12px',
                lineHeight: '150%',
              }}
            >
              By entering HAEVN, you agree to our{' '}
              <a
                href="https://www.haevn.co/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition-colors"
              >
                Terms of Service
              </a>
              . For details on how we honor and process your data, please see our{' '}
              <a
                href="https://www.haevn.co/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition-colors"
              >
                Privacy
              </a>
              {' '}and{' '}
              <a
                href="https://www.haevn.co/cookies-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition-colors"
              >
                Cookie
              </a>
              {' '}Policies.
            </p>

            {/* Footer links row */}
            <div className="flex items-center justify-center gap-3 text-white/90">
              <a
                href="https://www.haevn.co/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '12px',
                }}
              >
                Terms of Service
              </a>
              <span className="text-white/50">|</span>
              <a
                href="https://www.haevn.co/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '12px',
                }}
              >
                Privacy Policy
              </a>
              <span className="text-white/50">|</span>
              <a
                href="https://www.haevn.co/cookies-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '12px',
                }}
              >
                Cookies Policy
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
