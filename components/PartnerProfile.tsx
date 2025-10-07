'use client'

import { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HaevnLogo } from '@/components/HaevnLogo'
import { usePartnerStats } from '@/hooks/usePartnerStats'
import { Loader2 } from 'lucide-react'
import {
  Heart,
  MessageCircle,
  Sparkles,
  Target,
  Mail,
  User,
  Settings,
  Calendar,
  BookOpen,
  GraduationCap,
  ChevronRight
} from 'lucide-react'

export function PartnerProfile() {
  // Use live data from hook instead of mock data
  const { partnerData, hasPartnership, loading, error } = usePartnerStats()
  const [activeSection, setActiveSection] = useState('bio')
  const sectionsRef = useRef<{ [key: string]: HTMLElement | null }>({})

  const contentSections = [
    { id: 'bio', label: 'Bio', icon: Heart },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'communication', label: 'Communication', icon: MessageCircle },
    { id: 'archetype', label: 'Energy', icon: Sparkles }
  ]

  const personalItems = [
    { icon: Mail, label: 'Messages', href: '/messages' },
    { icon: User, label: 'Account details', href: '/account' },
    { icon: Settings, label: 'Survey', href: '/survey' }
  ]

  const resourcesItems = [
    { icon: Calendar, label: 'Events', href: '/events' },
    { icon: BookOpen, label: 'Glossary', href: '/glossary' },
    { icon: GraduationCap, label: 'Learn', href: '/learn' }
  ]

  // Intersection Observer for active section detection
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.6, rootMargin: '-100px 0px -50% 0px' }
    )

    Object.values(sectionsRef.current).forEach((section) => {
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  const scrollToSection = (sectionId: string) => {
    const element = sectionsRef.current[sectionId]
    if (element) {
      const offset = 180
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      })
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
  }

  console.log('🖼️ [PartnerProfile] Rendering with:', { loading, hasError: !!error, hasData: !!partnerData, hasPartnership })

  // Loading state
  if (loading) {
    console.log('⏳ [PartnerProfile] Showing loading spinner')
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
          <p className="text-body text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Loading profile...
          </p>
        </div>
      </div>
    )
  }

  // ONLY show error if there's a REAL error (not just missing partnership)
  if (error && !partnerData) {
    console.log('❌ [PartnerProfile] Showing error state:', error.message)

    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-[#252627]/10">
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-[#008080]/10 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-[#008080]" />
            </div>

            <div>
              <p className="text-h3 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                Profile Not Found
              </p>
              <p className="text-body text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                Your user profile hasn't been created yet. This usually happens automatically. Try refreshing the page.
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#008080] text-white rounded-lg hover:bg-[#006666] transition-colors"
              style={{ fontFamily: 'Roboto', fontWeight: 500 }}
            >
              Refresh Page
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No data state - should not happen if hooks are working
  if (!partnerData) {
    console.log('⚠️ [PartnerProfile] No partner data but no error - unexpected state')
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-[#252627]/10">
          <CardContent className="pt-6 text-center">
            <p className="text-h3 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              No profile found
            </p>
            <p className="text-body text-[#252627] mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              No profile data is available for this user yet. Try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#008080] text-white rounded-lg hover:bg-[#006666] transition-colors"
              style={{ fontFamily: 'Roboto', fontWeight: 500 }}
            >
              Refresh
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  console.log('✅ [PartnerProfile] Rendering profile for:', partnerData.username)
  console.log('✅ [PartnerProfile] Single-user mode:', !hasPartnership)

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-md mx-auto bg-[#E8E6E3] min-h-screen">

        {/* Logo at Top - Light Background */}
        <div className="bg-[#E8E6E3] pt-6 pb-3">
          <div className="container mx-auto px-6 flex justify-center">
            <img
              src="/haevn-logo-icon-white.svg"
              alt="HAEVN"
              className="h-[50px] w-auto block mx-auto shrink-0 brightness-0"
            />
          </div>
        </div>

        {/* Stats Card - Positioned on light background */}
        <div className="px-6 relative z-10">
          <Card className="bg-[#008080] border border-[#008080] shadow-md rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {/* Avatar Section */}
              <div className="flex flex-col items-center pt-6 pb-4">
                <Avatar className="h-24 w-24 border-4 border-[#E29E0C] shadow-md mb-3">
                  <AvatarImage src={partnerData.avatar} alt={partnerData.name} />
                  <AvatarFallback className="bg-white text-[#1E2A4A] text-2xl" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                    {getInitials(partnerData.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex items-center gap-2">
                  <h1 className="text-2xl text-white" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    {partnerData.username}
                  </h1>
                  {partnerData.isPaid && (
                    <Badge className="bg-[#E29E0C] text-white border-0 px-2 py-0.5" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                      PLUS
                    </Badge>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="bg-[#008080] px-6 py-5 grid grid-cols-3 gap-4 border-t border-white/20">
                <div className="text-center">
                  <p className="text-xs text-white/70 mb-1" style={{ fontFamily: 'Roboto', fontWeight: 500, lineHeight: '120%' }}>
                    Matches
                  </p>
                  <p className="text-3xl text-white" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    {partnerData.stats.matches}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/70 mb-1" style={{ fontFamily: 'Roboto', fontWeight: 500, lineHeight: '120%' }}>
                    Nudges
                  </p>
                  <p className="text-3xl text-white" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    {partnerData.stats.nudges}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/70 mb-1" style={{ fontFamily: 'Roboto', fontWeight: 500, lineHeight: '120%' }}>
                    Profile views
                  </p>
                  <p className="text-3xl text-white" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    {partnerData.stats.profileViews}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Single-User Mode Banner */}
        {!hasPartnership && (
          <div className="px-6 pt-4 pb-2">
            <Card className="bg-[#E29E0C]/10 border-[#E29E0C]/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Heart className="h-5 w-5 text-[#E29E0C]" />
                  </div>
                  <div>
                    <p className="text-body font-medium text-[#252627] mb-1" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                      You haven't connected with a partner yet
                    </p>
                    <p className="text-body-sm text-[#252627]/80" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                      Complete the partnership onboarding to unlock matches, nudges, and connections.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Matches Section Preview */}
        <div className="px-6 py-3 bg-transparent">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              Matches ({partnerData.stats.matches} of {partnerData.stats.matches})
            </p>
            <button className="text-sm text-[#008080] hover:underline" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
              View all
            </button>
          </div>
          <div className="flex items-center gap-2 py-4 border-b border-[#252627]/10">
            <div className="flex-1 h-1 bg-[#252627]/10 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-[#008080] rounded-full"></div>
            </div>
            <span className="text-xs text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>...</span>
          </div>
        </div>

        {/* Connections Section Preview */}
        <div className="px-6 py-3 bg-transparent">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              Connections ({partnerData.stats.connections} of {partnerData.stats.connections})
            </p>
            <button className="text-sm text-[#008080] hover:underline" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
              View all
            </button>
          </div>
          <div className="flex items-center gap-2 py-4 border-b border-[#252627]/10">
            <div className="flex-1 h-1 bg-[#252627]/10 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-[#008080] rounded-full"></div>
            </div>
            <span className="text-xs text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>...</span>
          </div>
        </div>

        {/* Sticky Content Tabs */}
        <div className="sticky top-0 z-40 bg-white border-b border-[#252627]/10 shadow-sm">
          <nav className="px-6 flex justify-between items-center py-2">
            {contentSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id

              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`
                    flex flex-col items-center gap-1 px-2 py-2 rounded-lg
                    transition-all duration-200 ease-out
                    ${isActive
                      ? 'text-[#E29E0C]'
                      : 'text-[#252627]/60 hover:text-[#1E2A4A]'
                    }
                  `}
                  style={{ fontFamily: 'Roboto', fontWeight: 500 }}
                >
                  <Icon className={`h-4 w-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span className="text-xs">{section.label}</span>
                  {isActive && (
                    <div className="w-6 h-0.5 bg-[#E29E0C] rounded-full"></div>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content Sections */}
        <div className="px-6 py-6 space-y-6 bg-transparent">

          {/* Bio Section */}
          <section
            id="bio"
            ref={(el) => { sectionsRef.current['bio'] = el }}
            className="scroll-mt-32"
          >
            <Card className="border-[#252627]/10 shadow-sm bg-white">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-[#E29E0C]" />
                  <h2 className="text-lg text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    About
                  </h2>
                </div>
                <p className="text-base text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300, lineHeight: '120%', textAlign: 'left' }}>
                  {partnerData.bio}
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Relationship Goals Section */}
          <section
            id="goals"
            ref={(el) => { sectionsRef.current['goals'] = el }}
            className="scroll-mt-32"
          >
            <Card className="border-[#252627]/10 shadow-sm bg-white">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-[#E29E0C]" />
                  <h2 className="text-lg text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    Relationship goals
                  </h2>
                </div>
                <ul className="space-y-2">
                  {partnerData.relationshipGoals.map((goal, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-base text-[#252627]"
                      style={{ fontFamily: 'Roboto', fontWeight: 300, lineHeight: '120%' }}
                    >
                      <span className="inline-block mt-2 h-1.5 w-1.5 rounded-full bg-[#E29E0C] flex-shrink-0" />
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* Communication Style Section */}
          <section
            id="communication"
            ref={(el) => { sectionsRef.current['communication'] = el }}
            className="scroll-mt-32"
          >
            <Card className="border-[#252627]/10 shadow-sm bg-white">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="h-4 w-4 text-[#E29E0C]" />
                  <h2 className="text-lg text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    Communication style
                  </h2>
                </div>
                <div className="space-y-3">
                  <Badge className="bg-[#008080] text-white border-0" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                    {partnerData.communicationStyle.primary}
                  </Badge>
                  <p className="text-base text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300, lineHeight: '120%' }}>
                    {partnerData.communicationStyle.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Archetype/Energy Section */}
          <section
            id="archetype"
            ref={(el) => { sectionsRef.current['archetype'] = el }}
            className="scroll-mt-32"
          >
            <Card className="border-[#252627]/10 shadow-sm bg-white">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-[#E29E0C]" />
                  <h2 className="text-lg text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    Energy archetype
                  </h2>
                </div>
                <div className="flex flex-col items-center text-center py-4">
                  <div className="text-5xl mb-3">
                    {partnerData.archetype.icon}
                  </div>
                  <h3 className="text-xl text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
                    {partnerData.archetype.name}
                  </h3>
                  <p className="text-base text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300, lineHeight: '120%' }}>
                    {partnerData.archetype.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>

        {/* Personal Section */}
        <div className="px-6 pt-4 pb-4 bg-transparent">
          <h3 className="text-base text-[#252627] mb-3 px-1" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Personal
          </h3>
          <div className="space-y-2">
            {personalItems.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-[#252627]/10 rounded-lg hover:bg-white/80 transition-colors"
                >
                  <Icon className="h-5 w-5 text-[#252627]/40" />
                  <span className="flex-1 text-left text-base text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#252627]/40" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Resources & Community Section */}
        <div className="px-6 pt-2 pb-8 bg-transparent">
          <h3 className="text-base text-[#252627] mb-3 px-1" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Resources & community
          </h3>
          <div className="space-y-2">
            {resourcesItems.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={index}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-[#252627]/10 rounded-lg hover:bg-white/80 transition-colors"
                >
                  <Icon className="h-5 w-5 text-[#252627]/40" />
                  <span className="flex-1 text-left text-base text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#252627]/40" />
                </button>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
