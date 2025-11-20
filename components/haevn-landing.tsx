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
          src="/images/hero-mobile.png"
          alt="HAEVN Hero Background"
          fill
          priority
          className="object-cover md:hidden"
          quality={90}
        />
        {/* Desktop Hero Image */}
        <Image
          src="/images/hero-desktop.png"
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
        {/* Main Content - Logo + Tagline at Top */}
        <main className="flex-1 flex items-start justify-center px-6 pt-12 pb-6">
          <div className="w-full max-w-md flex flex-col items-center text-center space-y-6">
            {/* Logo - Centered */}
            <div className="relative w-[220px] md:w-[280px] h-[55px] md:h-[70px]">
              <Image
                src="/images/haevn-logo-icon-white.png"
                alt="HAEVN"
                fill
                priority
                className="object-contain"
              />
            </div>

            {/* Tagline - Directly under logo */}
            <h1
              className="text-white"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 400,
                fontSize: '20px',
                lineHeight: '130%',
                letterSpacing: '-0.01em'
              }}
            >
              Thoughtful introductions based on compatibility, values and what you're actually looking for.
            </h1>
          </div>
        </main>

        {/* Footer - CTAs and Legal Links */}
        <footer className="pb-8 md:pb-12 px-6">
          <div className="w-full max-w-md mx-auto space-y-6">
            {/* CTA Buttons */}
            <div className="space-y-3">
              <Button
                onClick={() => router.push('/auth/signup')}
                className="w-full bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full h-14 text-lg font-medium transition-all"
                size="lg"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px'
                }}
              >
                Get Started
              </Button>
              <Button
                onClick={() => router.push('/auth/login')}
                variant="outline"
                className="w-full bg-white/10 hover:bg-white/20 text-white border-2 border-white rounded-full h-14 text-lg font-medium backdrop-blur-sm transition-all"
                size="lg"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 500,
                  fontSize: '18px'
                }}
              >
                Sign In
              </Button>
            </div>

            {/* Legal Links */}
            <div className="flex items-center justify-center gap-3 text-white/90 text-xs">
              <a
                href="https://www.haevn.co/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                style={{
                  fontFamily: 'Roboto, Helvetica, sans-serif',
                  fontWeight: 300,
                  fontSize: '12px'
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
                  fontSize: '12px'
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
                  fontSize: '12px'
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